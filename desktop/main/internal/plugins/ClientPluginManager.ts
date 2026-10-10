import { reactive, ref } from "vue";
import type {
  ClientPlugin,
  ClientPluginContext,
  ClientPluginWebSocket,
  CloudSavePathResolver,
  GameMenuItem,
  HttpMethod,
  LaunchContext,
  LaunchHook,
  LaunchOverrides,
  MetadataProvider,
  PlayAction,
  RunnerProvider,
  SidebarItem,
  Sidecar,
  StoreScanner,
  TopBarItem,
  UISlotName,
  UISlotRegistration,
} from "./types";

/** Platform data used to pick the matching sidecar target. */
export interface SidecarPlatform {
  os: "linux" | "macos" | "windows";
  arch: "x64" | "arm64";
}

/**
 * Best-effort host platform detection for sidecar target selection. Runs in
 * the desktop webview, where Tauri provides a real UA; wrong guesses never
 * break anything because staging is sha256-verified per target and failures
 * fall back to PATH resolution.
 */
export function detectSidecarPlatform(): SidecarPlatform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent ?? "";
  let os: SidecarPlatform["os"] | null = null;
  if (/windows/i.test(ua)) os = "windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macos";
  else if (/linux/i.test(ua)) os = "linux";
  if (!os) return null;
  const arch: SidecarPlatform["arch"] = /aarch64|arm64|apple m[123]/i.test(ua)
    ? "arm64"
    : "x64";
  return { os, arch };
}
import { safeInvoke } from "./host";
import { TauriPluginStorage } from "./host/storage";
import { TauriScopedGameFs } from "./host/game-fs";
import { TauriScopedGameScanner } from "./host/game-scanner";
import { TauriPluginWebSocket } from "./host/websocket";
import { createPluginSystem } from "./host/system";
import { executeLaunchPipeline as runLaunchPipeline } from "./launch-pipeline";

export { isTauri, safeInvoke } from "./host";

export class ClientPluginManager {
  private readonly plugins = new Map<string, ClientPlugin>();
  public readonly slots = reactive<Record<UISlotName, UISlotRegistration[]>>({
    "game-detail:actions": [],
    "game-detail:panels": [],
    "game-detail:badges": [],
    "settings:tabs": [],
    "topbar:status": [],
    "sidebar:nav": [],
    "overlay:panel": [],
    "overlay:quick-access": [],
  });

  public readonly playActionProviders: Array<
    (gameId: string) => Promise<PlayAction[]> | PlayAction[]
  > = [];
  public readonly gameMenuItems = reactive<GameMenuItem[]>([]);
  public readonly sidebarItems = reactive<SidebarItem[]>([]);
  public readonly topBarItems = reactive<TopBarItem[]>([]);
  public readonly launchHooks: LaunchHook[] = [];
  public readonly storeScanners = reactive<
    Array<{ pluginId: string; scanner: StoreScanner }>
  >([]);
  public readonly metadataProviders = reactive<
    Array<{ pluginId: string; provider: MetadataProvider }>
  >([]);
  public readonly cloudSaveResolvers = reactive<
    Array<{ pluginId: string; resolver: CloudSavePathResolver }>
  >([]);
  public readonly runnerProviders = reactive<
    Array<{ pluginId: string; provider: RunnerProvider }>
  >([]);

  /**
   * Host launch delegate wired by the library view so `ctx.launchGame` can
   * reuse the same launch-index resolution as the Play button. Falls back to a
   * direct native launch (index 0) when unset.
   */
  private gameLaunchHandler?: (
    gameId: string,
    overrides?: LaunchOverrides,
  ) => Promise<void>;

  /** Local (client-side) plugin event bus, keyed by event name. */
  private readonly localEvents = new Map<
    string,
    Set<(data: unknown) => void>
  >();

  public readonly serverWs: ClientPluginWebSocket = new TauriPluginWebSocket();

  public readonly isInitialized = ref(false);

  /**
   * Register the host launch delegate used by `ctx.launchGame`. The library
   * view wires this so plugin-triggered launches resolve the same launch option
   * index as the Play button; without it, launches fall back to index 0.
   */
  setGameLaunchHandler(
    handler: (gameId: string, overrides?: LaunchOverrides) => Promise<void>,
  ): void {
    this.gameLaunchHandler = handler;
  }

  /**
   * Stage the sidecar binary for the current platform that a plugin bundle
   * declares. The Tauri command verifies the SHA-256, stages the binary under
   * the plugin's app-data bin dir and makes it executable, so `ctx.system.run`
   * later resolves the allowlisted bare name against it. Non-fatal: hosts
   * without a matching target stay on PATH/fallbacks.
   */
  async stageSidecars(
    pluginId: string,
    commands: string[],
    sidecars: Sidecar[] | undefined,
  ): Promise<void> {
    if (!Array.isArray(sidecars) || sidecars.length === 0) return;
    const platform = detectSidecarPlatform();
    if (!platform) {
      console.debug("Unknown sidecar platform; skipping staging");
      return;
    }
    const commandSet = new Set(commands);
    for (const sidecar of sidecars) {
      if (!commandSet.has(sidecar.name)) continue;
      const target = sidecar.targets.find(
        (t) => t.os === platform.os && t.arch === platform.arch,
      );
      if (!target) continue;
      try {
        await safeInvoke("plugin_sidecar_stage", {
          pluginId,
          name: sidecar.name,
          asset: target.path,
          sha256: target.sha256,
        });
        console.debug("Staged sidecar:", pluginId, sidecar.name);
      } catch (err) {
        console.warn(
          "Failed to stage sidecar; falling back to PATH resolution:",
          pluginId,
          sidecar.name,
          err,
        );
      }
    }
  }

  /**
   * Register and initialize a client plugin instance.
   */
  async registerPlugin(
    plugin: ClientPlugin,
    id?: string,
    commands: string[] = [],
    capabilities: string[] = [],
    sidecars: Sidecar[] = [],
  ): Promise<void> {
    const pluginId = id || plugin.metadata?.id || "anonymous-plugin";
    if (this.plugins.has(pluginId)) {
      await this.unregisterPlugin(pluginId);
    }

    // Register the native command allowlist before init so `ctx.system.run`
    // works. Enforcement lives in the Tauri command layer, not here, so a
    // plugin cannot bypass it by calling invoke directly.
    try {
      await safeInvoke("plugin_register_commands", { pluginId, commands });
    } catch (err) {
      console.warn(
        `Failed to register command allowlist for ${pluginId}:`,
        err,
      );
    }

    // Stage declared sidecar binaries (sha256-verified) before init so
    // `ctx.system.run` can resolve their allowlisted bare names.
    await this.stageSidecars(pluginId, commands, sidecars);

    const context: ClientPluginContext = {
      id: pluginId,
      logger: {
        info: (msg, ...args) =>
          console.log(`[Plugin:${pluginId}] ${msg}`, ...args),
        warn: (msg, ...args) =>
          console.warn(`[Plugin:${pluginId}] ${msg}`, ...args),
        error: (msg, ...args) =>
          console.error(`[Plugin:${pluginId}] ${msg}`, ...args),
        debug: (msg, ...args) =>
          console.debug(`[Plugin:${pluginId}] ${msg}`, ...args),
      },
      storage: new TauriPluginStorage(pluginId),
      // Client-side declarative settings are optional; the key is always
      // present for surface parity with the server context but stays undefined
      // until the host injects a schema-backed snapshot.
      settings: undefined,
      registerSlot: (slot, component, options) => {
        if (!this.slots[slot]) {
          this.slots[slot] = [];
        }
        this.slots[slot].push({
          id: `${pluginId}-${slot}-${this.slots[slot].length}`,
          pluginId,
          slot,
          component,
          order: options?.order ?? 0,
          label: options?.label,
          icon: options?.icon,
        });
        this.slots[slot].sort((a, b) => a.order - b.order);
      },
      registerPlayAction: (provider) => {
        this.playActionProviders.push(provider);
        return () => {
          const idx = this.playActionProviders.indexOf(provider);
          if (idx !== -1) this.playActionProviders.splice(idx, 1);
        };
      },
      registerGameMenuItem: (item) => {
        this.gameMenuItems.push(item);
        return () => {
          const idx = this.gameMenuItems.indexOf(item);
          if (idx !== -1) this.gameMenuItems.splice(idx, 1);
        };
      },
      registerSidebarItem: (item) => {
        this.sidebarItems.push(item);
        return () => {
          const idx = this.sidebarItems.indexOf(item);
          if (idx !== -1) this.sidebarItems.splice(idx, 1);
        };
      },
      registerTopBarItem: (item) => {
        this.topBarItems.push(item);
        return () => {
          const idx = this.topBarItems.indexOf(item);
          if (idx !== -1) this.topBarItems.splice(idx, 1);
        };
      },
      registerLaunchHook: (hook) => {
        this.launchHooks.push(hook);
        return () => {
          const idx = this.launchHooks.indexOf(hook);
          if (idx !== -1) this.launchHooks.splice(idx, 1);
        };
      },
      registerStoreScanner: (scanner: StoreScanner) => {
        if (
          capabilities.length > 0 &&
          !capabilities.includes("client:library-scan")
        ) {
          throw new Error(
            `Client plugin '${pluginId}' attempted 'registerStoreScanner' without the 'client:library-scan' capability`,
          );
        }
        if (!scanner || typeof scanner.id !== "string" || !scanner.id.trim()) {
          throw new Error("Store scanner must have a valid non-empty id");
        }
        const entry = { pluginId, scanner };
        this.storeScanners.push(entry);
        return () => {
          const idx = this.storeScanners.indexOf(entry);
          if (idx !== -1) this.storeScanners.splice(idx, 1);
        };
      },
      registerMetadataProvider: (provider: MetadataProvider) => {
        if (
          capabilities.length > 0 &&
          !capabilities.includes("metadata:provider")
        ) {
          throw new Error(
            `Client plugin '${pluginId}' attempted 'registerMetadataProvider' without the 'metadata:provider' capability`,
          );
        }
        if (
          !provider ||
          typeof provider.id !== "string" ||
          !provider.id.trim()
        ) {
          throw new Error("Metadata provider must have a valid non-empty id");
        }
        const entry = { pluginId, provider };
        this.metadataProviders.push(entry);
        return () => {
          const idx = this.metadataProviders.indexOf(entry);
          if (idx !== -1) this.metadataProviders.splice(idx, 1);
        };
      },
      registerCloudSaveResolver: (resolver: CloudSavePathResolver) => {
        if (
          capabilities.length > 0 &&
          !capabilities.includes("cloudsave:provider")
        ) {
          throw new Error(
            `Client plugin '${pluginId}' attempted 'registerCloudSaveResolver' without the 'cloudsave:provider' capability`,
          );
        }
        if (
          !resolver ||
          typeof resolver.id !== "string" ||
          !resolver.id.trim()
        ) {
          throw new Error("Cloud save resolver must have a valid non-empty id");
        }
        const entry = { pluginId, resolver };
        this.cloudSaveResolvers.push(entry);
        return () => {
          const idx = this.cloudSaveResolvers.indexOf(entry);
          if (idx !== -1) this.cloudSaveResolvers.splice(idx, 1);
        };
      },
      registerRunnerProvider: (provider: RunnerProvider) => {
        if (capabilities.length > 0 && !capabilities.includes("game:runner")) {
          throw new Error(
            `Client plugin '${pluginId}' attempted 'registerRunnerProvider' without the 'game:runner' capability`,
          );
        }
        if (
          !provider ||
          typeof provider.id !== "string" ||
          !provider.id.trim()
        ) {
          throw new Error("Runner provider must have a valid non-empty id");
        }
        const entry = { pluginId, provider };
        this.runnerProviders.push(entry);
        return () => {
          const idx = this.runnerProviders.indexOf(entry);
          if (idx !== -1) this.runnerProviders.splice(idx, 1);
        };
      },
      launchGame: async (gameId: string, overrides?: LaunchOverrides) => {
        if (this.gameLaunchHandler) {
          await this.gameLaunchHandler(gameId, overrides);
          return;
        }
        // Best-effort fallback: launch option 0. The library view wires
        // `setGameLaunchHandler` so launch index + overrides resolve correctly.
        await safeInvoke("launch_game", { id: gameId, index: 0 });
      },
      ui: {
        openExternal: (url: string) =>
          safeInvoke("plugin_open_external", { url }),
      },
      events: {
        on: (event: string, listener: (data: unknown) => void) => {
          let listeners = this.localEvents.get(event);
          if (!listeners) {
            listeners = new Set();
            this.localEvents.set(event, listeners);
          }
          listeners.add(listener);
          return () => {
            const current = this.localEvents.get(event);
            if (!current) return;
            current.delete(listener);
            if (current.size === 0) this.localEvents.delete(event);
          };
        },
        emit: (event: string, data: unknown) => {
          const listeners = this.localEvents.get(event);
          if (!listeners) return;
          for (const listener of [...listeners]) {
            try {
              listener(data);
            } catch (err) {
              console.error(`Plugin event listener for '${event}' threw:`, err);
            }
          }
        },
      },
      gameFs: new TauriScopedGameFs(),
      gameScanner: new TauriScopedGameScanner(),
      serverWs: this.serverWs,
      system: createPluginSystem(pluginId),
      serverRequest: <T>(method: HttpMethod, path = "", body?: unknown) =>
        safeInvoke<T>("plugin_request", {
          pluginId,
          method,
          path,
          body,
        }),
    };

    try {
      await plugin.init(context);
      this.plugins.set(pluginId, plugin);
      console.log(`Initialized client plugin: ${pluginId}`);
    } catch (e) {
      console.error(`Failed to initialize client plugin ${pluginId}:`, e);
    }
  }

  async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      if (plugin.teardown) {
        try {
          await plugin.teardown();
        } catch (e) {
          console.error(`Error during plugin teardown for ${pluginId}:`, e);
        }
      }
      this.plugins.delete(pluginId);
    }

    // Drop the native command allowlist for this plugin.
    await safeInvoke("plugin_register_commands", {
      pluginId,
      commands: [],
    }).catch(() => {
      // Best effort: the plugin may never have registered a allowlist.
    });

    // Drop any staged sidecar binaries for this plugin.
    await safeInvoke("plugin_sidecar_clear", { pluginId }).catch(() => {
      // Best effort: the plugin may never have staged a sidecar.
    });

    // Clean up UI slots registered by this plugin
    for (const slotName of Object.keys(this.slots) as UISlotName[]) {
      this.slots[slotName] = this.slots[slotName].filter(
        (s) => s.pluginId !== pluginId,
      );
    }

    // Clean up store scanners and metadata providers registered by this plugin
    this.purgeOwned(this.storeScanners, pluginId);
    this.purgeOwned(this.metadataProviders, pluginId);
    this.purgeOwned(this.cloudSaveResolvers, pluginId);
    this.purgeOwned(this.runnerProviders, pluginId);
  }

  /** Removes every reactive entry owned by `pluginId` from `entries`. */
  private purgeOwned<T extends { pluginId: string }>(
    entries: T[],
    pluginId: string,
  ): void {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry?.pluginId === pluginId) {
        entries.splice(i, 1);
      }
    }
  }

  getStoreScanners(): StoreScanner[] {
    return this.storeScanners.map((e) => e.scanner);
  }

  getMetadataProviders(): MetadataProvider[] {
    return this.metadataProviders.map((e) => e.provider);
  }

  getCloudSaveResolvers(): CloudSavePathResolver[] {
    return this.cloudSaveResolvers.map((e) => e.resolver);
  }

  getRunnerProviders(): RunnerProvider[] {
    return this.runnerProviders.map((e) => e.provider);
  }

  /**
   * Load client plugin bundle from a URL (e.g. served by Drop server).
   */
  async loadFromUrl(
    pluginId: string,
    bundleUrl: string,
    cssUrl?: string,
    commands: string[] = [],
    capabilities: string[] = [],
    sidecars: Sidecar[] = [],
  ): Promise<void> {
    if (cssUrl) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssUrl;
      link.dataset.pluginId = pluginId;
      document.head.appendChild(link);
    }

    const mod = await import(/* @vite-ignore */ bundleUrl);
    const candidates: Array<ClientPlugin | undefined> = [
      mod.default,
      mod.plugin,
    ];
    const pluginExport = candidates.find((candidate) => candidate?.init);

    if (!pluginExport) {
      throw new Error(
        `Module at ${bundleUrl} does not export a valid ClientPlugin`,
      );
    }

    await this.registerPlugin(
      pluginExport,
      pluginId,
      commands,
      capabilities,
      sidecars,
    );
  }

  /**
   * Query all registered Play Actions for a given game.
   */
  async getPlayActions(gameId: string): Promise<PlayAction[]> {
    const actions: PlayAction[] = [];
    for (const provider of this.playActionProviders) {
      try {
        const result = await provider(gameId);
        actions.push(...result);
      } catch (err) {
        console.error(
          `Error querying play action provider for game ${gameId}:`,
          err,
        );
      }
    }
    return actions;
  }

  /**
   * Playnite-style Game Launch Pipeline Coordinator.
   * Executes pre-launch hooks sorted by stage and priority.
   * If any pre-launch hook aborts, completed stages are rolled back in reverse order.
   * If launch succeeds, executes post-exit cleanup hooks.
   */
  async executeLaunchPipeline<T>(
    context: LaunchContext,
    launchFn: () => Promise<T>,
  ): Promise<T> {
    return runLaunchPipeline(this.launchHooks, context, launchFn);
  }
}

// Global Singleton Instance
export const clientPluginManager = new ClientPluginManager();
