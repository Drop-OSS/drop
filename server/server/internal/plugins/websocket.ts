import type {
  SubscriptionAuthorizer,
  SubscriptionContext,
  WebSocketContext,
  WebSocketHandler,
  WebSocketOptions,
} from "./types";

interface SubscriptionAuthorizerEntry {
  matches: (channel: string) => boolean;
  authorize: SubscriptionAuthorizer;
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
 * Plugin WebSocket channel registry: handlers, public-channel designations and
 * subscription authorizers, all reclaimed when their plugin unloads.
 */
export class PluginWebSocketRegistry {
  private readonly handlers = new Map<
    string,
    { pluginId: string; handler: WebSocketHandler }
  >();
  private readonly publicChannelOwners = new Map<string, string>(); // channel -> pluginId
  private readonly subscriptionAuthorizers = new Map<
    string,
    SubscriptionAuthorizerEntry[]
  >();

  register(
    pluginId: string,
    channel: string,
    handler: WebSocketHandler,
    options?: WebSocketOptions,
  ): void {
    const existing = this.handlers.get(channel);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `WebSocket channel '${channel}' is already claimed by plugin '${existing.pluginId}'`,
      );
    }
    this.handlers.set(channel, { pluginId, handler });
    if (options?.public) {
      this.publicChannelOwners.set(channel, pluginId);
    }
  }

  registerPublic(pluginId: string, channel: string): void {
    this.publicChannelOwners.set(channel, pluginId);
  }

  addAuthorizer(
    pluginId: string,
    matches: (channel: string) => boolean,
    authorize: SubscriptionAuthorizer,
  ): void {
    const entries = this.subscriptionAuthorizers.get(pluginId) ?? [];
    entries.push({ matches, authorize });
    this.subscriptionAuthorizers.set(pluginId, entries);
  }

  /** Drop a plugin's handlers, public channels and authorizers. */
  release(pluginId: string): void {
    purgeOwned(this.handlers, pluginId);
    for (const [channel, owner] of this.publicChannelOwners) {
      if (owner === pluginId) {
        this.publicChannelOwners.delete(channel);
      }
    }
    this.subscriptionAuthorizers.delete(pluginId);
  }

  /**
   * Whether a client may subscribe to `channel`. Only authorizers whose
   * `matches` accepts the channel are consulted; when none match the channel
   * is allowed (the gateway still requires authentication for non-public
   * channels).
   */
  async canSubscribe(
    channel: string,
    context: SubscriptionContext,
  ): Promise<boolean> {
    const matching: SubscriptionAuthorizer[] = [];
    for (const entries of this.subscriptionAuthorizers.values()) {
      for (const entry of entries) {
        if (entry.matches(channel)) matching.push(entry.authorize);
      }
    }
    if (matching.length === 0) return true;
    for (const authorize of matching) {
      if (await authorize(channel, context)) return true;
    }
    return false;
  }

  /** Route a client WebSocket message to the plugin that claimed the channel. */
  async dispatch(
    channel: string,
    message: unknown,
    context: WebSocketContext,
    isPluginActive: (pluginId: string) => boolean,
  ): Promise<boolean> {
    const entry = this.handlers.get(channel);
    if (!entry) return false;
    if (!isPluginActive(entry.pluginId)) return false;
    await entry.handler(message, context);
    return true;
  }

  channels(): string[] {
    return Array.from(this.handlers.keys());
  }

  isPublicChannel(channel: string): boolean {
    return this.publicChannelOwners.has(channel);
  }

  publicChannels(): string[] {
    return Array.from(this.publicChannelOwners.keys());
  }
}
