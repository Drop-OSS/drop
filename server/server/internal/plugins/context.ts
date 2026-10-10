import type { Logger } from "pino";
import { PluginCapabilityError } from "./errors";
import type { PluginEventBus } from "./events";
import type { PluginRouteTable } from "./routes";
import type { PluginWebSocketRegistry } from "./websocket";
import type {
  AuthProvider,
  CloudSavePathResolver,
  DepotStorageProvider,
  MetadataProvider,
  PaymentGateway,
  PluginCapability,
  PluginContext,
  PluginStorage,
  ServerPlugin,
} from "./types";
import {
  PLUGIN_SETTINGS_STORAGE_KEY,
  applySettingsDefaults,
  normalizeSettingsSchema,
} from "./settings";

function hasCapability(
  capabilities: PluginCapability[] | undefined,
  cap: PluginCapability,
): boolean {
  // Fail closed: a plugin that does not explicitly declare a capability
  // cannot use it.
  return capabilities?.includes(cap) ?? false;
}

/** Deletes every map entry whose value is owned by plugin `id`. */
function purgeOwned<V extends { pluginId: string }>(
  map: Map<string, V>,
  id: string,
): void {
  for (const [key, entry] of map) {
    if (entry.pluginId === id) {
      map.delete(key);
    }
  }
}

/**
 * Registry of SPI implementations contributed by plugins. Registration is
 * capability-gated and rejects collisions with another plugin's entry; every
 * entry is dropped when its plugin unloads.
 */
export class PluginSpiRegistry {
  private readonly metadataProviders = new Map<
    string,
    { pluginId: string; provider: MetadataProvider }
  >();
  private readonly cloudSaveResolvers = new Map<
    string,
    { pluginId: string; resolver: CloudSavePathResolver }
  >();
  private readonly paymentGateways = new Map<
    string,
    { pluginId: string; gateway: PaymentGateway }
  >();
  private readonly authProviders = new Map<
    string,
    { pluginId: string; provider: AuthProvider }
  >();
  private readonly depotProviders = new Map<
    string,
    { pluginId: string; provider: DepotStorageProvider }
  >();

  registerMetadataProvider(
    pluginId: string,
    provider: MetadataProvider,
    capabilities: PluginCapability[] | undefined,
  ): void {
    if (!provider || typeof provider.id !== "string" || !provider.id.trim()) {
      throw new Error("Metadata provider must have a valid non-empty id");
    }
    if (!hasCapability(capabilities, "metadata:provider")) {
      throw new PluginCapabilityError(
        pluginId,
        "metadata:provider",
        `registerMetadataProvider(${provider.id})`,
      );
    }
    const existing = this.metadataProviders.get(provider.id);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Metadata provider '${provider.id}' is already claimed by plugin '${existing.pluginId}'`,
      );
    }
    this.metadataProviders.set(provider.id, { pluginId, provider });
  }

  registerCloudSaveResolver(
    pluginId: string,
    resolver: CloudSavePathResolver,
    capabilities: PluginCapability[] | undefined,
  ): void {
    if (!resolver || typeof resolver.id !== "string" || !resolver.id.trim()) {
      throw new Error("Cloud save resolver must have a valid non-empty id");
    }
    if (!hasCapability(capabilities, "cloudsave:provider")) {
      throw new PluginCapabilityError(
        pluginId,
        "cloudsave:provider",
        `registerCloudSaveResolver(${resolver.id})`,
      );
    }
    const existing = this.cloudSaveResolvers.get(resolver.id);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Cloud save resolver '${resolver.id}' is already claimed by plugin '${existing.pluginId}'`,
      );
    }
    this.cloudSaveResolvers.set(resolver.id, { pluginId, resolver });
  }

  registerPaymentGateway(
    pluginId: string,
    gateway: PaymentGateway,
    capabilities: PluginCapability[] | undefined,
  ): void {
    if (!gateway || typeof gateway.id !== "string" || !gateway.id.trim()) {
      throw new Error("Payment gateway must have a valid non-empty id");
    }
    if (!hasCapability(capabilities, "commerce:payment")) {
      throw new PluginCapabilityError(
        pluginId,
        "commerce:payment",
        `registerPaymentGateway(${gateway.id})`,
      );
    }
    const existing = this.paymentGateways.get(gateway.id);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Payment gateway '${gateway.id}' is already claimed by plugin '${existing.pluginId}'`,
      );
    }
    this.paymentGateways.set(gateway.id, { pluginId, gateway });
  }

  registerAuthProvider(
    pluginId: string,
    provider: AuthProvider,
    capabilities: PluginCapability[] | undefined,
  ): void {
    if (!provider || typeof provider.id !== "string" || !provider.id.trim()) {
      throw new Error("Auth provider must have a valid non-empty id");
    }
    if (!hasCapability(capabilities, "auth:provider")) {
      throw new PluginCapabilityError(
        pluginId,
        "auth:provider",
        `registerAuthProvider(${provider.id})`,
      );
    }
    const existing = this.authProviders.get(provider.id);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Auth provider '${provider.id}' is already claimed by plugin '${existing.pluginId}'`,
      );
    }
    this.authProviders.set(provider.id, { pluginId, provider });
  }

  registerDepotProvider(
    pluginId: string,
    provider: DepotStorageProvider,
    capabilities: PluginCapability[] | undefined,
  ): void {
    if (!provider || typeof provider.id !== "string" || !provider.id.trim()) {
      throw new Error("Depot provider must have a valid non-empty id");
    }
    if (!hasCapability(capabilities, "storage:depot")) {
      throw new PluginCapabilityError(
        pluginId,
        "storage:depot",
        `registerDepotProvider(${provider.id})`,
      );
    }
    const existing = this.depotProviders.get(provider.id);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Depot provider '${provider.id}' is already claimed by plugin '${existing.pluginId}'`,
      );
    }
    this.depotProviders.set(provider.id, { pluginId, provider });
  }

  release(pluginId: string): void {
    purgeOwned(this.metadataProviders, pluginId);
    purgeOwned(this.cloudSaveResolvers, pluginId);
    purgeOwned(this.paymentGateways, pluginId);
    purgeOwned(this.authProviders, pluginId);
    purgeOwned(this.depotProviders, pluginId);
  }

  getMetadataProviders(): MetadataProvider[] {
    return Array.from(this.metadataProviders.values()).map((e) => e.provider);
  }

  getMetadataProvider(id: string): MetadataProvider | undefined {
    return this.metadataProviders.get(id)?.provider;
  }

  getCloudSaveResolvers(): CloudSavePathResolver[] {
    return Array.from(this.cloudSaveResolvers.values()).map((e) => e.resolver);
  }

  getCloudSaveResolver(id: string): CloudSavePathResolver | undefined {
    return this.cloudSaveResolvers.get(id)?.resolver;
  }

  getPaymentGateways(): PaymentGateway[] {
    return Array.from(this.paymentGateways.values()).map((e) => e.gateway);
  }

  getPaymentGateway(id: string): PaymentGateway | undefined {
    return this.paymentGateways.get(id)?.gateway;
  }

  getAuthProviders(): AuthProvider[] {
    return Array.from(this.authProviders.values()).map((e) => e.provider);
  }

  getAuthProvider(id: string): AuthProvider | undefined {
    return this.authProviders.get(id)?.provider;
  }

  getDepotProviders(): DepotStorageProvider[] {
    return Array.from(this.depotProviders.values()).map((e) => e.provider);
  }

  getDepotProvider(id: string): DepotStorageProvider | undefined {
    return this.depotProviders.get(id)?.provider;
  }
}

/** Schedules a recurring plugin task; returns an unregister callback. */
export type PluginTaskScheduler = (
  pluginId: string,
  name: string,
  intervalMs: number,
  task: () => void | Promise<void>,
) => () => void;

/** Resources a plugin context is built from. */
export interface PluginContextHost {
  routes: PluginRouteTable;
  webSockets: PluginWebSocketRegistry;
  events: PluginEventBus;
  spi: PluginSpiRegistry;
  createStorage(pluginId: string): Promise<PluginStorage>;
  scheduleTask: PluginTaskScheduler;
  log: Logger;
}

/**
 * Restrict storage access to plugins that declared the `storage` capability.
 * Missing capability is fail-closed: every method throws rather than
 * silently reading/writing.
 */
function guardStorage(
  pluginId: string,
  capabilities: PluginCapability[] | undefined,
  storage: PluginStorage,
): PluginStorage {
  if (hasCapability(capabilities, "storage")) {
    return storage;
  }
  const deny = (operation: string): never => {
    throw new PluginCapabilityError(pluginId, "storage", operation);
  };
  return {
    get: async () => deny("storage.get"),
    set: async () => deny("storage.set"),
    delete: async () => deny("storage.delete"),
    listKeys: async () => deny("storage.listKeys"),
    getSchemaVersion: async () => deny("storage.getSchemaVersion"),
    setSchemaVersion: async () => deny("storage.setSchemaVersion"),
  };
}

/** Build the capability-gated context handed to a plugin's `init`. */
export async function createPluginContext(
  host: PluginContextHost,
  plugin: ServerPlugin,
): Promise<PluginContext> {
  const id = plugin.metadata.id;
  const capabilities = plugin.metadata.capabilities;
  const pluginLogger = host.log.child({ plugin: id });
  // Host-managed settings read from the unguarded storage so a plugin can
  // declare a `settingsSchema` without also needing the `storage` capability.
  const rawStorage = await host.createStorage(id);
  const storage = guardStorage(id, capabilities, rawStorage);
  host.routes.create(id);

  const schema = normalizeSettingsSchema(plugin.metadata.settingsSchema);
  let settings: Readonly<Record<string, unknown>> | undefined;
  if (schema) {
    const stored = await rawStorage.get<Record<string, unknown>>(
      PLUGIN_SETTINGS_STORAGE_KEY,
    );
    settings = Object.freeze(applySettingsDefaults(schema, stored));
  }

  return {
    id,
    logger: pluginLogger,
    storage,
    settings,
    registerRoute: (method, pattern, handler) => {
      if (!hasCapability(capabilities, "routes")) {
        throw new PluginCapabilityError(
          id,
          "routes",
          `registerRoute(${pattern})`,
        );
      }

      host.routes.register(id, method, pattern, handler);
      pluginLogger.debug(`Registered route [${method}] ${pattern}`);
    },
    broadcast: (channel: string, event: unknown) => {
      if (!hasCapability(capabilities, "events")) {
        throw new PluginCapabilityError(id, "events", `broadcast(${channel})`);
      }
      host.events.emit(channel, event);
    },
    subscribe: (channel: string, listener: (event: unknown) => void) => {
      if (!hasCapability(capabilities, "events")) {
        throw new PluginCapabilityError(id, "events", `subscribe(${channel})`);
      }
      return host.events.subscribeScoped(id, channel, listener);
    },
    registerWebSocket: (channel, handler, options) => {
      if (!hasCapability(capabilities, "websocket")) {
        throw new PluginCapabilityError(
          id,
          "websocket",
          `registerWebSocket(${channel})`,
        );
      }
      host.webSockets.register(id, channel, handler, options);
    },
    registerPublicWebSocketChannel: (channel: string) => {
      if (!hasCapability(capabilities, "websocket")) {
        throw new PluginCapabilityError(
          id,
          "websocket",
          `registerPublicWebSocketChannel(${channel})`,
        );
      }
      host.webSockets.registerPublic(id, channel);
    },
    registerSubscriptionAuthorizer: (
      matches: (channel: string) => boolean,
      authorize,
    ) => {
      if (!hasCapability(capabilities, "websocket")) {
        throw new PluginCapabilityError(
          id,
          "websocket",
          "registerSubscriptionAuthorizer",
        );
      }
      host.webSockets.addAuthorizer(id, matches, authorize);
    },
    fetch: async (input: string | URL, init?: RequestInit) => {
      if (!hasCapability(capabilities, "network")) {
        throw new PluginCapabilityError(id, "network", "fetch");
      }
      return fetch(input, init);
    },
    registerMetadataProvider: (provider) => {
      host.spi.registerMetadataProvider(id, provider, capabilities);
      pluginLogger.debug(`Registered metadata provider: ${provider.id}`);
    },
    registerCloudSaveResolver: (resolver) => {
      host.spi.registerCloudSaveResolver(id, resolver, capabilities);
      pluginLogger.debug(`Registered cloud save resolver: ${resolver.id}`);
    },
    registerPaymentGateway: (gateway) => {
      host.spi.registerPaymentGateway(id, gateway, capabilities);
      pluginLogger.debug(`Registered payment gateway: ${gateway.id}`);
    },
    registerAuthProvider: (provider) => {
      host.spi.registerAuthProvider(id, provider, capabilities);
      pluginLogger.debug(`Registered auth provider: ${provider.id}`);
    },
    registerDepotProvider: (provider) => {
      host.spi.registerDepotProvider(id, provider, capabilities);
      pluginLogger.debug(`Registered depot provider: ${provider.id}`);
    },
    scheduleTask: (name, intervalMs, task) =>
      host.scheduleTask(id, name, intervalMs, task),
  };
}
