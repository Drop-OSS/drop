import type { H3Event } from "h3";
import type { Logger } from "pino";
import type {
  AuthProvider,
  CloudSavePathResolver,
  DepotStorageProvider,
  HttpMethod,
  MetadataProvider,
  PaymentGateway,
  PluginMetadata,
} from "@drop/plugin-api";

/**
 * Shared plugin contract types (manifest, capabilities, SPI results) live in
 * the `@drop/plugin-api` workspace package so the server and desktop client
 * cannot drift. This module layers the server-runtime types that depend on
 * `h3`/`pino` and the runtime API-version constants on top of them.
 */
export type * from "@drop/plugin-api";

/**
 * Current plugin API version. Bump this when `PluginContext` or the manifest
 * contract changes incompatibly. Plugins declare the version they were built
 * against in `metadata.apiVersion`; mismatches are rejected at registration.
 */
export const PLUGIN_API_VERSION = 3;
export const SUPPORTED_API_VERSIONS = [1, 2, 3] as const;

export interface RouteHandlerContext {
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  userId?: string;
  userAcls?: string[];
}

export type RouteHandler = (
  event: H3Event,
  context: RouteHandlerContext,
) => unknown;

export interface PluginStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  listKeys(): Promise<string[]>;
  /** Declared/recorded schema version for `migrateStorage`. */
  getSchemaVersion(): Promise<number>;
  setSchemaVersion(version: number): Promise<void>;
}

/** Caller identity + reply sink for a plugin WebSocket message. */
export interface WebSocketContext {
  userId?: string;
  userAcls?: string[];
  send: (data: unknown) => void;
}

/** Caller identity available when authorizing a channel subscription. */
export interface SubscriptionContext {
  userId: string | undefined;
  userAcls: string[] | undefined;
}

/**
 * Authorize a client subscription to a channel. Returning `false` denies the
 * subscription; a channel with no matching authorizer is allowed (subject to
 * the gateway's authentication requirement).
 */
export type SubscriptionAuthorizer = (
  channel: string,
  context: SubscriptionContext,
) => Promise<boolean> | boolean;

export type WebSocketHandler = (
  message: unknown,
  context: WebSocketContext,
) => Promise<void> | void;

export interface WebSocketOptions {
  /**
   * If true, clients can subscribe to and receive broadcasts on this channel
   * without an authenticated user session (e.g. public game lobbies, server status).
   * Defaults to false.
   */
  public?: boolean;
}

export interface PluginContext {
  id: string;
  logger: Logger;
  storage: PluginStorage;
  settings?: Readonly<Record<string, unknown>>;
  registerRoute(
    method: HttpMethod,
    pattern: string,
    handler: RouteHandler,
  ): void;
  broadcast(channel: string, event: unknown): void;
  subscribe(channel: string, listener: (event: unknown) => void): () => void;
  /**
   * Handle client messages on a WebSocket channel. Requires the `websocket`
   * capability. Channel names are global; a channel may only be claimed once.
   */
  registerWebSocket(
    channel: string,
    handler: WebSocketHandler,
    options?: WebSocketOptions,
  ): void;
  /**
   * Mark a channel as publicly readable without authentication.
   * Requires the `websocket` capability.
   */
  registerPublicWebSocketChannel(channel: string): void;
  /**
   * Gate client subscriptions to channels matching `matches`. Requires the
   * `websocket` capability. Channels with no matching authorizer stay open to
   * authenticated peers.
   */
  registerSubscriptionAuthorizer(
    matches: (channel: string) => boolean,
    authorize: SubscriptionAuthorizer,
  ): void;
  /** Network egress. Requires the `network` capability. */
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
  /**
   * Register a metadata provider SPI implementation.
   * Requires the `metadata:provider` capability.
   */
  registerMetadataProvider(provider: MetadataProvider): void;
  /**
   * Register a cloud save path resolver SPI implementation.
   * Requires the `cloudsave:provider` capability.
   */
  registerCloudSaveResolver(resolver: CloudSavePathResolver): void;
  /**
   * Register a payment gateway SPI implementation.
   * Requires the `commerce:payment` capability.
   */
  registerPaymentGateway(gateway: PaymentGateway): void;
  /**
   * Register an authentication provider SPI implementation.
   * Requires the `auth:provider` capability.
   */
  registerAuthProvider?(provider: AuthProvider): void;
  /**
   * Register a remote depot storage provider SPI implementation.
   * Requires the `storage:depot` capability.
   */
  registerDepotProvider?(provider: DepotStorageProvider): void;
  /**
   * Schedule a recurring background task. Returns an unregister callback that
   * stops the task and is invoked automatically when the plugin unloads.
   */
  scheduleTask?(
    name: string,
    intervalMs: number,
    task: () => void | Promise<void>,
  ): () => void;
}

export interface ServerPlugin {
  metadata: PluginMetadata;
  init(ctx: PluginContext): Promise<void> | void;
  teardown?(): Promise<void> | void;
  /**
   * Apply storage migrations when the recorded schema version is older than
   * `metadata.storageVersion`. `from` is exclusive, `to` inclusive.
   */
  migrateStorage?(
    from: number,
    to: number,
    storage: PluginStorage,
  ): Promise<void>;
}
