import { listen } from "@tauri-apps/api/event";
import type { ClientPluginWebSocket } from "../types";
import { isTauri, safeInvoke } from "../host";

export class TauriPluginWebSocket implements ClientPluginWebSocket {
  async send(channel: string, data: unknown): Promise<unknown> {
    return await safeInvoke("plugin_request_ws", { channel, data });
  }

  subscribe(channel: string, listener: (data: unknown) => void): () => void {
    if (isTauri()) {
      let disposed = false;
      let unlisten: (() => void) | undefined;

      safeInvoke("plugin_subscribe", { channel }).catch((err) => {
        console.error(`Failed to subscribe to plugin channel ${channel}:`, err);
      });

      // The Rust host forwards decoded WebSocket frames as the Tauri event
      // `plugin:event`. Tauri events are not DOM events, so the payload must be
      // consumed with `listen` rather than `window.addEventListener`.
      void listen<{ channel?: string; data?: unknown }>(
        "plugin:event",
        (event) => {
          if (event.payload?.channel === channel) {
            listener(event.payload.data);
          }
        },
      )
        .then((off) => {
          if (disposed) off();
          else unlisten = off;
        })
        .catch((err) => {
          console.error(
            `Failed to listen for plugin events on ${channel}:`,
            err,
          );
        });

      return () => {
        disposed = true;
        unlisten?.();
        unlisten = undefined;
      };
    }

    // Browser/dev fallback: a host harness can dispatch a DOM CustomEvent.
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ channel?: string; data?: unknown }>;
      if (custom?.detail?.channel === channel) {
        listener(custom.detail.data);
      }
    };

    window.addEventListener("plugin:event", handler);
    return () => {
      window.removeEventListener("plugin:event", handler);
    };
  }
}
