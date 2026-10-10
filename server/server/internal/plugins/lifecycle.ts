import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createError } from "h3";
import type { Logger } from "pino";
import { assertPluginCompatible, isValidPluginId } from "./compat";
import type {
  PluginContext,
  PluginMetadata,
  PluginStateRecord,
  PluginStatus,
  PluginStorage,
  ServerPlugin,
} from "./types";

export interface LoadedPlugin {
  plugin: ServerPlugin;
  context: PluginContext;
  status: PluginStatus;
  error?: Error;
}

/** Collaboration points the lifecycle needs from the plugin manager. */
export interface PluginLifecycleHooks {
  /** Builds the context (routes/websockets/events/storage) for a plugin. */
  createContext(plugin: ServerPlugin): Promise<PluginContext>;
  /** Drops every resource owned by `pluginId`. */
  releaseResources(pluginId: string): void;
  /** Notified when a plugin is disabled/enabled so clients observe state. */
  notifyStateChange(pluginId: string, enabled: boolean): void;
  /** Base data directory. Defaults to the server's configured data folder. */
  dataDir?: string;
  log: Logger;
}

/**
 * Owns the plugin record table, the persisted enabled/disabled state
 * (`plugins/_state.json`) and the register/activate/toggle/teardown lifecycle.
 */
export class PluginLifecycle {
  private readonly plugins = new Map<string, LoadedPlugin>();

  constructor(private readonly hooks: PluginLifecycleHooks) {}

  private async getDataFolder(): Promise<string> {
    if (this.hooks.dataDir !== undefined) {
      return this.hooks.dataDir;
    }
    const { systemConfig } = await import("../config/sys-conf");
    return systemConfig.getDataFolder();
  }

  async getPluginsDirectory(): Promise<string> {
    return path.join(await this.getDataFolder(), "plugins");
  }

  private async getStateFilePath(): Promise<string> {
    return path.join(await this.getPluginsDirectory(), "_state.json");
  }

  private async loadState(): Promise<Record<string, PluginStateRecord>> {
    try {
      const data = await fs.readFile(await this.getStateFilePath(), "utf-8");
      return JSON.parse(data) as Record<string, PluginStateRecord>;
    } catch {
      return {};
    }
  }

  private async saveState(
    state: Record<string, PluginStateRecord>,
  ): Promise<void> {
    const filePath = await this.getStateFilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
  }

  getRecord(id: string): LoadedPlugin | undefined {
    return this.plugins.get(id);
  }

  isActive(id: string): boolean {
    return this.plugins.get(id)?.status === "active";
  }

  list(): Array<
    PluginMetadata & {
      status: PluginStatus;
      error?: string;
    }
  > {
    return Array.from(this.plugins.values()).map((p) => ({
      ...p.plugin.metadata,
      status: p.status,
      error: p.error?.message,
    }));
  }

  get(id: string): ServerPlugin | undefined {
    return this.plugins.get(id)?.plugin;
  }

  /**
   * Run a plugin's storage migrations when its recorded schema version is
   * behind the version it declares. No-op for plugins that do not set
   * `storageVersion`.
   */
  private async runStorageMigrations(
    plugin: ServerPlugin,
    storage: PluginStorage,
  ): Promise<void> {
    const target = plugin.metadata.storageVersion ?? 0;
    if (target <= 0) return;
    const current = await storage.getSchemaVersion();
    if (current >= target) return;
    if (plugin.migrateStorage) {
      await plugin.migrateStorage(current, target, storage);
    }
    await storage.setSchemaVersion(target);
  }

  async register(plugin: ServerPlugin): Promise<void> {
    const id = plugin.metadata.id;
    if (!isValidPluginId(id)) {
      throw new Error(`invalid plugin id '${id}'`);
    }
    assertPluginCompatible(plugin);
    if (this.plugins.has(id)) {
      this.hooks.log.warn(`Plugin ${id} is already registered, replacing`);
      await this.unregister(id);
    }

    const state = await this.loadState();
    const isExplicitlyDisabled = state[id]?.enabled === false;

    const context = await this.hooks.createContext(plugin);
    const loaded: LoadedPlugin = {
      plugin,
      context,
      status: isExplicitlyDisabled ? "disabled" : "registered",
    };
    this.plugins.set(id, loaded);

    if (isExplicitlyDisabled) {
      this.hooks.log.info(
        `Plugin '${plugin.metadata.name}' (${id}) is registered but disabled by configuration`,
      );
      return;
    }

    await this.runStorageMigrations(plugin, context.storage);

    try {
      await plugin.init(context);
      loaded.status = "active";
      this.hooks.log.info(
        `Plugin '${plugin.metadata.name}' (${id} v${plugin.metadata.version}) initialized`,
      );
    } catch (err) {
      loaded.status = "error";
      loaded.error = err as Error;
      this.hooks.log.error(`Failed to initialize plugin ${id}: ${err}`);
      throw err;
    }
  }

  async unregister(id: string): Promise<void> {
    const loaded = this.plugins.get(id);
    if (!loaded) return;

    if (loaded.plugin.teardown && loaded.status === "active") {
      try {
        await loaded.plugin.teardown();
      } catch (err) {
        this.hooks.log.warn(`Error during plugin ${id} teardown: ${err}`);
      }
    }

    this.hooks.releaseResources(id);
    this.plugins.delete(id);
    this.hooks.log.info(`Plugin ${id} unregistered`);
  }

  async toggle(id: string, enabled: boolean): Promise<boolean> {
    const loaded = this.plugins.get(id);
    if (!loaded) {
      throw createError({
        statusCode: 404,
        statusMessage: `Plugin '${id}' not found`,
      });
    }

    const state = await this.loadState();
    state[id] = { enabled, updatedAt: Date.now() };
    await this.saveState(state);

    if (enabled) {
      await this.enable(id, loaded);
    } else {
      await this.disable(id, loaded);
    }

    return true;
  }

  private async disable(id: string, loaded: LoadedPlugin): Promise<void> {
    if (loaded.status !== "active") return;

    if (loaded.plugin.teardown) {
      try {
        await loaded.plugin.teardown();
      } catch (err) {
        this.hooks.log.warn(`Error tearing down plugin ${id}: ${err}`);
      }
    }
    this.hooks.releaseResources(id);
    loaded.status = "disabled";
    this.hooks.log.info(`Plugin '${id}' disabled`);
    this.hooks.notifyStateChange(id, false);
  }

  private async enable(id: string, loaded: LoadedPlugin): Promise<void> {
    if (loaded.status === "active") return;

    const context = await this.hooks.createContext(loaded.plugin);
    loaded.context = context;
    await this.runStorageMigrations(loaded.plugin, context.storage);
    try {
      await loaded.plugin.init(context);
      loaded.status = "active";
      loaded.error = undefined;
      this.hooks.log.info(`Plugin '${id}' enabled and initialized`);
      this.hooks.notifyStateChange(id, true);
    } catch (err) {
      loaded.status = "error";
      loaded.error = err as Error;
      this.hooks.log.error(`Failed to re-initialize plugin ${id}: ${err}`);
      throw err;
    }
  }
}
