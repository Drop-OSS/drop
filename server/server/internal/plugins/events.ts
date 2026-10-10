import { EventEmitter } from "node:events";

/**
 * Plugin event bus. Subscriptions made through `subscribeScoped` are tracked
 * per plugin and released together when the plugin unloads.
 */
export class PluginEventBus {
  private readonly bus = new EventEmitter();
  private readonly scopedSubscriptions = new Map<string, Array<() => void>>();

  constructor() {
    this.bus.setMaxListeners(200);
  }

  emit(channel: string, data: unknown): void {
    this.bus.emit(channel, data);
  }

  subscribe(channel: string, listener: (data: unknown) => void): () => void {
    this.bus.on(channel, listener);
    return () => {
      this.bus.off(channel, listener);
    };
  }

  /** Subscribe on behalf of `pluginId`; cleanup happens on `release`. */
  subscribeScoped(
    pluginId: string,
    channel: string,
    listener: (event: unknown) => void,
  ): () => void {
    const off = this.subscribe(channel, listener);
    const subscriptions = this.scopedSubscriptions.get(pluginId) ?? [];
    subscriptions.push(off);
    this.scopedSubscriptions.set(pluginId, subscriptions);
    return off;
  }

  /** Drop every subscription owned by `pluginId`. */
  release(pluginId: string): void {
    const subscriptions = this.scopedSubscriptions.get(pluginId) ?? [];
    for (const off of subscriptions) {
      off();
    }
    this.scopedSubscriptions.delete(pluginId);
  }
}
