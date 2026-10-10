/**
 * Core plugin API contracts shared by the Drop server and desktop client.
 *
 * This package is intentionally type-only: every export is a type or an
 * interface, so consumers must use `import type`/`export type`. Keeping it
 * free of runtime values avoids bundler and module-resolution issues in
 * Nuxt/Nitro, where the package is consumed purely for type checking.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "ALL";

export type PluginTarget = "server" | "client";

export type PluginCategory = "generic" | "metadata" | "storage" | "multiplayer";

export type ServerCapability =
  | "routes"
  | "storage"
  | "websocket"
  | "events"
  | "network"
  | "metadata:provider"
  | "cloudsave:provider"
  | "commerce:payment"
  | "auth:provider"
  | "storage:depot";

export type ClientCapability =
  | "ui:slot"
  | "ui:play-action"
  | "ui:context-menu"
  | "ui:sidebar"
  | "ui:topbar"
  | "game:launch-hook"
  | "game:fs"
  | "game:scan"
  | "client:storage"
  | "client:ws"
  | "system:sidecar"
  | "system:command"
  | "metadata:provider"
  | "cloudsave:provider"
  | "client:library-scan"
  | "game:runner";

export type PluginCapability = ServerCapability | ClientCapability;

/**
 * Trust tier. Only `"trusted"` is supported today: plugins run in-process with
 * the server or client's own privileges. `"sandboxed"` is reserved for a future
 * isolated runtime and must be rejected until that runtime exists.
 */
export type PluginTrust = "trusted" | "sandboxed";

export type PluginStatus = "active" | "disabled" | "error" | "registered";

export type PluginSettingsFieldType =
  "string" | "password" | "number" | "boolean" | "select";

export interface PluginSettingsOption {
  label: string;
  value: unknown;
}

export interface PluginSettingsField {
  key: string;
  label: string;
  type: PluginSettingsFieldType;
  description?: string;
  default?: unknown;
  options?: PluginSettingsOption[];
  required?: boolean;
}

export interface PluginSettingsSchema {
  fields: PluginSettingsField[];
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  builtin?: boolean;
  /** Plugin API version the plugin was built against. */
  apiVersion?: number;
  /** Trust tier. Defaults to "trusted". */
  trust?: PluginTrust;
  /** Declared storage schema version; drives `migrateStorage`. */
  storageVersion?: number;
  category?: PluginCategory;
  targets?: PluginTarget[];
  capabilities?: PluginCapability[];
  enabled?: boolean;
  /** Declarative configuration settings schema rendered automatically by host UIs. */
  settingsSchema?: PluginSettingsSchema;
}

export interface PluginManifest extends PluginMetadata {
  entry?: string;
  /**
   * Legacy alias for `client.entry`. Drop Desktop reads `client.entry`
   * (defaulting to `bundle.js`) and never consults this field, so new
   * manifests should declare the client entry inside the `client` block.
   */
  clientEntry?: string;
  /** SHA-256 of the entry file, hex. Verified before the bundle is imported. */
  checksum?: string;
  /**
   * SHA-256 of every file the bundle may import, keyed by path relative to the
   * bundle directory. Required for multi-file bundles so relative imports are
   * verified too. When present with `DROP_PLUGIN_SIGNING_KEY`, `signature`
   * covers the aggregate bundle digest rather than only the entry file.
   */
  files?: Record<string, string>;
  /**
   * Signature scheme marker. Bundles signed by `@drop-oss/plugin-cli` >= 0.6.0
   * carry `2`, meaning `signature` covers the file aggregate plus the canonical
   * manifest. Absent on legacy bundles, whose signature covers the file
   * aggregate or entry checksum only.
   */
  signatureVersion?: number;
  /**
   * HMAC-SHA256 (hex) of the signature payload, keyed by
   * `DROP_PLUGIN_SIGNING_KEY`. Set `DROP_PLUGIN_REQUIRE_SIGNATURE=true` to
   * reject unsigned bundles.
   */
  signature?: string;

  server?: {
    entry: string;
    /** TypeScript/JavaScript source the CLI bundles into `entry`. */
    source?: string;
    capabilities: ServerCapability[];
    storageVersion?: number;
  };
  client?: {
    entry: string;
    /** TypeScript/JavaScript source the CLI bundles into `entry`. */
    source?: string;
    css?: string;
    capabilities: ClientCapability[];
    slots?: Array<{ slot: string; component: string }>;
    /**
     * Bare executable names the client plugin may run via `ctx.system.run`
     * (requires the `system:command` capability). Enforced by the desktop host.
     */
    commands?: string[];
    /**
     * Native sidecar binaries shipped inside the plugin bundle and staged by
     * the desktop host at activation time (requires the `system:sidecar`
     * capability). Each declared sidecar `name` must also appear in `commands`;
     * the host stages the target whose `os`/`arch` match the current platform,
     * verifies `sha256`, and resolves the allowlisted bare name against the
     * staged binary.
     */
    sidecars?: Sidecar[];
  };
}

/** One declared native sidecar executable bundled with the client plugin. */
export interface Sidecar {
  /** Bare executable name; must also be listed in `client.commands`. */
  name: string;
  /** Per-platform (and per-architecture) binaries for this sidecar. */
  targets: SidecarTarget[];
}

/** A platform-specific sidecar binary declared inside the plugin bundle. */
export interface SidecarTarget {
  /** Target operating system. */
  os: "linux" | "macos" | "windows";
  /** Target CPU architecture. */
  arch: "x64" | "arm64";
  /** Bundle-relative path to the binary (POSIX separators). */
  path: string;
  /** SHA-256 hex digest of the binary contents, verified by build, validate, and the hosts. */
  sha256: string;
}

export interface PluginStateRecord {
  enabled: boolean;
  updatedAt: number;
}

/**
 * Logger contract exposed to plugins. Matches the matching interface in
 * `@drop-oss/plugin-sdk` so plugin code can be typed against either package.
 */
export interface PluginLogger {
  info(msg: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
}

// ==========================================
// Payment Gateway SPI (#21)
// ==========================================

export interface PaymentIntentRequest {
  orderId: string;
  amount: number; // minor units (e.g. cents)
  currency: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentIntentResult {
  intentId: string;
  clientSecret?: string;
  checkoutUrl?: string;
  status: "pending" | "succeeded" | "failed";
}

export interface PaymentWebhookResult {
  orderId: string;
  status: "succeeded" | "failed" | "refunded";
  transactionId: string;
  payload?: Record<string, unknown>;
}

export interface PaymentGateway {
  id: string;
  name: string;
  createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResult>;
  handleWebhook(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<PaymentWebhookResult>;
}

// ==========================================
// Authentication Provider SPI (#12)
// ==========================================

export interface AuthUser {
  externalId: string;
  username: string;
  email?: string;
  displayName?: string;
  groups?: string[];
}

export interface AuthResult {
  authenticated: boolean;
  user?: AuthUser;
  error?: string;
  unavailable?: boolean;
}

export interface AuthProvider {
  id: string;
  name: string;
  authenticate(credentials: {
    username: string;
    password: string;
  }): Promise<AuthResult>;
}

// ==========================================
// Remote Depot & Storage Provider SPI (#14, #17, #21)
// ==========================================

export interface DepotDownloadStream {
  url?: string;
  headers?: Record<string, string>;
  pieceReader?: (offset: number, length: number) => Promise<Uint8Array>;
}

export interface DepotStorageProvider {
  id: string;
  name: string;
  resolveDepotStream(
    depotId: string,
    gameId: string,
  ): Promise<DepotDownloadStream | null>;
}
