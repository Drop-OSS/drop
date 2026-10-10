import type { HttpMethod, PluginLogger, PluginMetadata } from "./common";

export type { HttpMethod };

export type UISlotName =
  | "game-detail:actions"
  | "game-detail:panels"
  | "game-detail:badges"
  | "settings:tabs"
  | "topbar:status"
  | "sidebar:nav"
  | "overlay:panel"
  | "overlay:quick-access";

export interface UISlotRegistration {
  id: string;
  pluginId: string;
  slot: UISlotName;
  component: unknown;
  order: number;
  label?: string;
  icon?: string;
}

export interface LaunchContext {
  gameId: string;
  gameTitle: string;
  gameDir: string;
  actionId?: string;
  metadata?: Record<string, unknown>;
}

export type LaunchStage =
  | "pre-launch:validate"
  | "pre-launch:prepare"
  | "pre-launch:stage"
  | "pre-launch:network"
  | "pre-launch:network-post"
  | "launch"
  | "post-exit:cleanup"
  | "post-exit:restore"
  | "post-exit:sync";

export interface LaunchHook {
  stage: LaunchStage;
  order?: number;
  execute: (ctx: LaunchContext) => Promise<void> | void;
}

export interface PlayAction {
  id: string;
  name: string;
  icon?: string;
  isDefault?: boolean;
  execute: (context: LaunchContext) => Promise<void> | void;
}

export interface GameMenuItem {
  id: string;
  label: string;
  icon?: string;
  execute: (gameId: string) => Promise<void> | void;
}

export interface SidebarItem {
  id: string;
  title: string;
  icon?: string;
  type: "button" | "view";
  progressValue?: number;
  activated?: () => void;
  component?: unknown;
}

export interface TopBarItem {
  id: string;
  title: string;
  icon?: string;
  component?: unknown;
  activated?: () => void;
}

export interface ScopedGameFs {
  readFile(gameId: string, relativePath: string): Promise<Uint8Array>;
  writeFile(
    gameId: string,
    relativePath: string,
    data: Uint8Array | string,
  ): Promise<void>;
  backupFile(gameId: string, relativePath: string): Promise<string>;
  restoreFile(gameId: string, relativePath: string): Promise<void>;
  fileExists(gameId: string, relativePath: string): Promise<boolean>;
  deleteFile(gameId: string, relativePath: string): Promise<void>;
}

export interface ScopedGameScanner {
  scanExecutables(
    gameId: string,
  ): Promise<Array<{ relativePath: string; sha256: string; size: number }>>;
  /**
   * Returns the relative paths of installed files whose path contains any of
   * the supplied patterns (case-insensitive). The host is agnostic about the
   * patterns, so plugins own domain knowledge such as anti-cheat detection.
   */
  findFiles(gameId: string, patterns: string[]): Promise<string[]>;
}

export interface ClientPluginStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  listKeys(): Promise<string[]>;
}

export interface ClientPluginWebSocket {
  send(channel: string, data: unknown): Promise<unknown>;
  subscribe(channel: string, listener: (data: unknown) => void): () => void;
}

/** Result of a native command run through the client host. */
export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface CommandOptions {
  cwd?: string;
  timeoutMs?: number;
}

/**
 * Native command execution for client plugins. The host runs the binary
 * directly (no shell) and enforces the per-plugin allowlist registered from
 * `manifest.client.commands`.
 */
export interface ClientPluginSystem {
  run(
    bin: string,
    args?: string[],
    options?: CommandOptions,
  ): Promise<CommandResult>;
}

export interface ClientPluginContext {
  id: string;
  logger: PluginLogger;
  storage: ClientPluginStorage;
  settings?: Readonly<Record<string, unknown>>;
  registerSlot(
    slot: UISlotName,
    component: unknown,
    options?: { order?: number; label?: string; icon?: string },
  ): void;
  registerPlayAction(
    provider: (gameId: string) => Promise<PlayAction[]> | PlayAction[],
  ): () => void;
  registerGameMenuItem(item: GameMenuItem): () => void;
  registerSidebarItem(item: SidebarItem): () => void;
  registerTopBarItem(item: TopBarItem): () => void;
  registerLaunchHook(hook: LaunchHook): () => void;
  /**
   * Register a store library scanner SPI implementation.
   * Requires the `client:library-scan` capability.
   */
  registerStoreScanner(scanner: StoreScanner): () => void;
  /**
   * Register a client-side metadata provider SPI implementation.
   * Requires the `metadata:provider` capability.
   */
  registerMetadataProvider?(provider: MetadataProvider): () => void;
  /**
   * Register a client-side cloud save path resolver SPI implementation.
   * Requires the `cloudsave:provider` capability.
   */
  registerCloudSaveResolver?(resolver: CloudSavePathResolver): () => void;
  /**
   * Register a game compatibility runner provider SPI implementation.
   * Requires the `game:runner` capability.
   */
  registerRunnerProvider?(provider: RunnerProvider): () => void;
  launchGame?(gameId: string, overrides?: LaunchOverrides): Promise<void>;
  library?: unknown;
  ui?: unknown;
  events?: unknown;
  gameFs: ScopedGameFs;
  gameScanner: ScopedGameScanner;
  serverWs: ClientPluginWebSocket;
  /** Native command execution. Requires the `system:command` capability. */
  system: ClientPluginSystem;
  /**
   * Call this plugin's own server-side REST routes through the desktop host.
   * The webview cannot reach the Drop server directly, so the host proxies the
   * request. `path` is relative to `/api/v1/plugins/<pluginId>`.
   */
  serverRequest<T = unknown>(
    method: HttpMethod,
    path?: string,
    body?: unknown,
  ): Promise<T>;
}

export interface ClientPlugin {
  metadata?: PluginMetadata;
  init(ctx: ClientPluginContext): Promise<void> | void;
  teardown?(): Promise<void> | void;
}

// ==========================================
// Metadata Provider SPI (#7, #206, #207, #477)
// ==========================================

export interface MetadataSearchResult {
  id: string;
  title: string;
  releaseYear?: number;
  coverUrl?: string;
  bannerUrl?: string;
  iconUrl?: string;
  description?: string;
  provider: string;
}

export interface MetadataDetails extends MetadataSearchResult {
  genres?: string[];
  developers?: string[];
  publishers?: string[];
  screenshots?: string[];
  metadata?: Record<string, unknown>;
}

export interface MetadataProvider {
  id: string;
  name: string;
  search(query: string): Promise<MetadataSearchResult[]>;
  getDetails(id: string): Promise<MetadataDetails | null>;
}

// ==========================================
// Store Scanner SPI (#21)
// ==========================================

export interface ScannedGame {
  externalId: string;
  store: "steam" | "gog" | "epic" | string;
  title: string;
  installPath: string;
  executablePath?: string;
  iconUrl?: string;
  version?: string;
}

export interface StoreScanner {
  id: string;
  name: string;
  store: string;
  scan(): Promise<ScannedGame[]>;
  launch?(externalId: string): Promise<void>;
}

// ==========================================
// Cloud Save Provider SPI (#9)
// ==========================================

export interface CloudSavePattern {
  pattern: string;
  platform?: "windows" | "linux" | "macos";
  winePrefix?: boolean;
}

export interface GameInstallContext {
  gameId: string;
  gameTitle: string;
  installDir?: string;
  winePrefix?: string;
  executableName?: string;
}

export interface CloudSavePathResolver {
  id: string;
  name: string;
  resolveSavePaths(
    gameContext: GameInstallContext,
  ): Promise<CloudSavePattern[]>;
}

// ==========================================
// Compatibility & Runner Provider SPI (#10, #13, #18)
// ==========================================

export type RunnerPlatform =
  | "windows"
  | "linux"
  | "macos"
  | "rom"
  | (string & {});

export interface LaunchOverrides {
  executable?: string;
  arguments?: string[];
  environment?: Record<string, string>;
  workingDirectory?: string;
  wrapperBin?: string;
  wrapperArgs?: string[];
}

export interface RunnerProvider {
  id: string;
  name: string;
  supportedPlatforms: RunnerPlatform[];
  detect(): Promise<{ available: boolean; version?: string }>;
  resolveLaunch(context: LaunchContext): Promise<LaunchOverrides>;
}

