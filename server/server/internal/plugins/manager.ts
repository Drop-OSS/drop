import type { H3Event } from "h3";
import { createError } from "h3";
import type { Logger } from "pino";
import { logger } from "../logging";
import { PluginRegistry } from "./registry";
import { PluginEventBus } from "./events";
import { PluginRouteTable } from "./routes";
import { PluginWebSocketRegistry } from "./websocket";
import { PluginLifecycle } from "./lifecycle";
import {
  PluginSpiRegistry,
  createPluginContext as buildPluginContext,
} from "./context";
import type { PluginContextHost } from "./context";
import {
  checkForUpdates as checkBundledPluginUpdates,
  discoverAndLoadExternalPlugins as discoverExternalPlugins,
  getClientAssetPath as resolveClientAssetPath,
  installBundle as installPluginBundle,
  installFromUrl as installPluginFromUrl,
  reloadPlugins as reloadExternalPlugins,
  removeBundle as removePluginBundle,
} from "./bundle";
import type { PluginBundleHost, PluginUpdateInfo } from "./bundle";
import type {
  AuthProvider,
  CloudSavePathResolver,
  DepotStorageProvider,
  MetadataProvider,
  PaymentGateway,
  PluginManifest,
  PluginMetadata,
  PluginSettingsSchema,
  PluginStatus,
  PluginStorage,
  ServerPlugin,
  SubscriptionContext,
  WebSocketContext,
} from "./types";
import {
  PLUGIN_SETTINGS_STORAGE_KEY,
  applySettingsDefaults,
  mergeSettingsPayload,
  normalizeSettingsSchema,
  redactSettingsValues,
  validateSettingsValues,
} from "./settings";

/** Resolved caller identity passed to route handlers. */
export interface PluginAuthContext {
  userId?: string;
  userAcls?: string[];
}

/**
 * Injectable dependencies. The defaults resolve Drop's runtime config and ACL
 * manager lazily, so this module can be imported (and unit-tested) outside a
 * Nuxt/Nitro runtime.
 */
export interface PluginManagerOptions {
  /** Base data directory. Defaults to the server's configured data folder. */
  dataDir?: string;
  /** Per-plugin storage factory. Defaults to {@link FilePluginStorage}. */
  storageFactory?: (pluginId: string) => PluginStorage;
  /** Auth resolver for dispatched routes. Defaults to Drop's ACL manager. */
  authResolver?: (event: H3Event) => Promise<PluginAuthContext>;
  /**
   * Path to a plugin registry JSON (allow-list + version/checksum pinning).
   * Defaults to `DROP_PLUGIN_REGISTRY`; no registry by default.
   */
  registryPath?: string;
}

/**
 * Thin facade over the plugin runtime modules: route table, WebSocket
 * registry, event bus, SPI registry, lifecycle and bundle loader.
 */
export class PluginManager {
  private readonly options: PluginManagerOptions;
  private readonly log: Logger = logger.child({ name: "plugin-manager" });
  private readonly routes = new PluginRouteTable();
  private readonly webSockets = new PluginWebSocketRegistry();
  private readonly events = new PluginEventBus();
  private readonly spi = new PluginSpiRegistry();
  /**
   * Memoized storage instances per plugin so the guarded context storage and
   * host-managed settings reads/writes share one instance and cannot observe
   * stale copies of the on-disk state.
   */
  private readonly storageInstances = new Map<string, PluginStorage>();
  /** Recurring plugin tasks keyed by `<pluginId>:<taskName>`. */
  private readonly scheduledTasks = new Map<
    string,
    { pluginId: string; timer: NodeJS.Timeout }
  >();
  private readonly lifecycle: PluginLifecycle;
  private readonly contextHost: PluginContextHost;
  private readonly bundleHost: PluginBundleHost;

  constructor(options: PluginManagerOptions = {}) {
    this.options = options;
    this.contextHost = {
      routes: this.routes,
      webSockets: this.webSockets,
      events: this.events,
      spi: this.spi,
      log: this.log,
      createStorage: (pluginId) => this.getStorageInstance(pluginId),
      scheduleTask: (pluginId, name, intervalMs, task) =>
        this.scheduleTask(pluginId, name, intervalMs, task),
    };
    this.bundleHost = {
      log: this.log,
      getPluginsDirectory: () => this.lifecycle.getPluginsDirectory(),
      getRegistry: () => this.loadRegistry(),
      registerPlugin: (plugin) => this.registerPlugin(plugin),
      unregisterPlugin: (id) => this.unregisterPlugin(id),
      getPlugin: (id) => this.getPlugin(id),
      listPlugins: () => this.listPlugins(),
    };
    this.lifecycle = new PluginLifecycle({
      dataDir: options.dataDir,
      log: this.log,
      createContext: (plugin) => buildPluginContext(this.contextHost, plugin),
      releaseResources: (id) => this.releaseResources(id),
      notifyStateChange: (id, enabled) =>
        this.broadcast("plugins:state", { id, enabled }),
    });
  }

  private async createStorage(pluginId: string): Promise<PluginStorage> {
    if (this.options.storageFactory) {
      return this.options.storageFactory(pluginId);
    }
    const { FilePluginStorage } = await import("./storage");
    return new FilePluginStorage(pluginId, this.options.dataDir);
  }

  private async getStorageInstance(pluginId: string): Promise<PluginStorage> {
    const existing = this.storageInstances.get(pluginId);
    if (existing) return existing;
    const created = await this.createStorage(pluginId);
    this.storageInstances.set(pluginId, created);
    return created;
  }

  /**
   * Register a recurring task for a plugin. Re-registering the same
   * `<pluginId>:<name>` replaces the previous timer. Timers are unref'd so they
   * never keep the process alive.
   */
  private scheduleTask(
    pluginId: string,
    name: string,
    intervalMs: number,
    task: () => void | Promise<void>,
  ): () => void {
    if (typeof name !== "string" || !name.trim()) {
      throw new Error("Task name must be a non-empty string");
    }
    if (
      typeof intervalMs !== "number" ||
      !Number.isFinite(intervalMs) ||
      intervalMs <= 0
    ) {
      throw new Error(
        "Task interval must be a positive number of milliseconds",
      );
    }
    const key = `${pluginId}:${name}`;
    const existing = this.scheduledTasks.get(key);
    if (existing) {
      clearInterval(existing.timer);
      this.scheduledTasks.delete(key);
    }
    const timer = setInterval(() => {
      void Promise.resolve()
        .then(task)
        .catch((err) =>
          this.log.error(`Plugin task '${key}' threw: ${String(err)}`),
        );
    }, intervalMs);
    timer.unref?.();
    this.scheduledTasks.set(key, { pluginId, timer });
    return () => {
      const entry = this.scheduledTasks.get(key);
      if (entry) {
        clearInterval(entry.timer);
        this.scheduledTasks.delete(key);
      }
    };
  }

  private async loadRegistry(): Promise<PluginRegistry> {
    const registryPath =
      this.options.registryPath ?? process.env.DROP_PLUGIN_REGISTRY;
    // Re-read on demand so provisioning or updating the registry file takes
    // effect without a process restart.
    return await PluginRegistry.load(registryPath);
  }

  /** Drop a plugin's routes, sockets, SPI entries and event subscriptions. */
  private releaseResources(id: string): void {
    this.routes.release(id);
    this.webSockets.release(id);
    this.spi.release(id);
    this.events.release(id);
    this.storageInstances.delete(id);
    for (const [key, entry] of this.scheduledTasks) {
      if (entry.pluginId === id) {
        clearInterval(entry.timer);
        this.scheduledTasks.delete(key);
      }
    }
  }

  private async resolveAuth(event: H3Event): Promise<PluginAuthContext> {
    if (this.options.authResolver) {
      return this.options.authResolver(event);
    }
    const { resolvePluginAuth } = await import("./auth");
    return await resolvePluginAuth(event);
  }

  async registerPlugin(plugin: ServerPlugin): Promise<void> {
    await this.lifecycle.register(plugin);
  }

  async unregisterPlugin(id: string): Promise<void> {
    await this.lifecycle.unregister(id);
  }

  async togglePlugin(id: string, enabled: boolean): Promise<boolean> {
    return await this.lifecycle.toggle(id, enabled);
  }

  async discoverAndLoadExternalPlugins(): Promise<void> {
    await discoverExternalPlugins(this.bundleHost);
  }

  async installBundle(
    manifest: PluginManifest,
    entryOrFiles: string | Record<string, string>,
  ): Promise<void> {
    await installPluginBundle(this.bundleHost, manifest, entryOrFiles);
  }

  async installFromUrl(url: string): Promise<void> {
    await installPluginFromUrl(this.bundleHost, url);
  }

  async checkForUpdates(): Promise<PluginUpdateInfo[]> {
    return await checkBundledPluginUpdates(this.bundleHost);
  }

  async removeBundle(id: string): Promise<boolean> {
    return await removePluginBundle(this.bundleHost, id);
  }

  async reloadPlugins(): Promise<void> {
    await reloadExternalPlugins(this.bundleHost);
  }

  listPlugins(): Array<
    PluginMetadata & {
      status: PluginStatus;
      error?: string;
    }
  > {
    return this.lifecycle.list();
  }

  getPlugin(id: string): ServerPlugin | undefined {
    return this.lifecycle.get(id);
  }

  broadcast(channel: string, data: unknown): void {
    this.events.emit(channel, data);
  }

  subscribe(channel: string, listener: (data: unknown) => void): () => void {
    return this.events.subscribe(channel, listener);
  }

  async canSubscribe(
    channel: string,
    context: SubscriptionContext,
  ): Promise<boolean> {
    return await this.webSockets.canSubscribe(channel, context);
  }

  async dispatchWebSocket(
    channel: string,
    message: unknown,
    context: WebSocketContext,
  ): Promise<boolean> {
    return await this.webSockets.dispatch(channel, message, context, (id) =>
      this.lifecycle.isActive(id),
    );
  }

  webSocketChannels(): string[] {
    return this.webSockets.channels();
  }

  isPublicChannel(channel: string): boolean {
    return this.webSockets.isPublicChannel(channel);
  }

  publicWebSocketChannels(): string[] {
    return this.webSockets.publicChannels();
  }

  getMetadataProviders(): MetadataProvider[] {
    return this.spi.getMetadataProviders();
  }

  getMetadataProvider(id: string): MetadataProvider | undefined {
    return this.spi.getMetadataProvider(id);
  }

  getCloudSaveResolvers(): CloudSavePathResolver[] {
    return this.spi.getCloudSaveResolvers();
  }

  getCloudSaveResolver(id: string): CloudSavePathResolver | undefined {
    return this.spi.getCloudSaveResolver(id);
  }

  getPaymentGateways(): PaymentGateway[] {
    return this.spi.getPaymentGateways();
  }

  getPaymentGateway(id: string): PaymentGateway | undefined {
    return this.spi.getPaymentGateway(id);
  }

  getAuthProviders(): AuthProvider[] {
    return this.spi.getAuthProviders();
  }

  getAuthProvider(id: string): AuthProvider | undefined {
    return this.spi.getAuthProvider(id);
  }

  getDepotProviders(): DepotStorageProvider[] {
    return this.spi.getDepotProviders();
  }

  getDepotProvider(id: string): DepotStorageProvider | undefined {
    return this.spi.getDepotProvider(id);
  }

  /** Declarative settings schema for a loaded plugin, if declared. */
  getSettingsSchema(id: string): PluginSettingsSchema | undefined {
    const plugin = this.lifecycle.get(id);
    return normalizeSettingsSchema(plugin?.metadata.settingsSchema);
  }

  /** Reads + default-fills the host-managed settings for `pluginId`. */
  private async readSettingsFor(
    pluginId: string,
    schema: PluginSettingsSchema | undefined,
  ): Promise<Record<string, unknown>> {
    if (!schema) return {};
    const storage = await this.getStorageInstance(pluginId);
    const stored = await storage.get<Record<string, unknown>>(
      PLUGIN_SETTINGS_STORAGE_KEY,
    );
    return applySettingsDefaults(schema, stored);
  }

  /** Effective settings values (including defaults) for a loaded plugin. */
  async getPluginSettings(id: string): Promise<Record<string, unknown>> {
    if (!this.lifecycle.getRecord(id)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Plugin '${id}' not found`,
      });
    }
    return await this.readSettingsFor(id, this.getSettingsSchema(id));
  }

  /** Settings view with `password` values redacted, for API consumers. */
  async getPluginSettingsView(id: string): Promise<{
    schema: PluginSettingsSchema;
    values: Record<string, unknown>;
    secrets: Record<string, boolean>;
  } | null> {
    const schema = this.getSettingsSchema(id);
    if (!schema) return null;
    const values = await this.readSettingsFor(id, schema);
    const redacted = redactSettingsValues(schema, values);
    return { schema, values: redacted.values, secrets: redacted.secrets };
  }

  /** Validate + persist a partial settings update. Returns the redacted view. */
  async setPluginSettings(id: string, submitted: unknown) {
    if (!this.lifecycle.getRecord(id)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Plugin '${id}' not found`,
      });
    }
    const schema = this.getSettingsSchema(id);
    if (!schema) {
      throw createError({
        statusCode: 400,
        statusMessage: `Plugin '${id}' does not declare a settingsSchema`,
      });
    }
    const current = await this.readSettingsFor(id, schema);
    const merge = mergeSettingsPayload(schema, current, submitted);
    const validation = validateSettingsValues(schema, merge.input);
    const errors = [...merge.errors, ...validation.errors];
    if (errors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: errors.join("; "),
      });
    }
    const storage = await this.getStorageInstance(id);
    await storage.set(PLUGIN_SETTINGS_STORAGE_KEY, validation.values);
    return await this.getPluginSettingsView(id);
  }

  async getClientAssetPath(
    pluginId: string,
    assetRelPath: string,
  ): Promise<string | null> {
    return await resolveClientAssetPath(
      this.bundleHost,
      pluginId,
      assetRelPath,
    );
  }

  async dispatch(
    pluginId: string,
    method: string,
    rawSubPath: string,
    event: H3Event,
  ): Promise<unknown> {
    const loaded = this.lifecycle.getRecord(pluginId);
    if (!loaded) {
      throw createError({
        statusCode: 404,
        statusMessage: `Plugin '${pluginId}' not found`,
      });
    }

    if (loaded.status !== "active") {
      throw createError({
        statusCode: 503,
        statusMessage: `Plugin '${pluginId}' is currently ${loaded.status}`,
      });
    }

    return await this.routes.dispatch(
      pluginId,
      method,
      rawSubPath,
      event,
      (h3Event) => this.resolveAuth(h3Event),
    );
  }
}

export const pluginManager = new PluginManager();
export default pluginManager;
