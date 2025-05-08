import taskHandler from "~/server/internal/tasks";
import type { MinimumRequestObject } from "~/server/h3";
import cacheHandler from "~/server/internal/cache";

// ID to admin
const socketHeaders = cacheHandler.createCache<MinimumRequestObject>("taskSocketHeaders");

export default defineWebSocketHandler({
  async open(peer) {
    const request = peer.request;
    if (!request) {
      peer.send("unauthenticated");
      return;
    }

    await socketHeaders.set(peer.id, {
      headers: request.headers ?? new Headers(),
    });
    peer.send(`connect`);
  },
  async message(peer, message) {
    if (!peer.id) return;
    const headers = await socketHeaders.get(peer.id);
    if (!headers) return;
    const text = message.text();
    if (text.startsWith("connect/")) {
      const id = text.substring("connect/".length);
      taskHandler.connect(peer.id, id, peer, headers);
      return;
    }
  },
  async close(peer, _details) {
    if (!peer.id) return;
    if (!socketHeaders.has(peer.id)) return;
    await socketHeaders.remove(peer.id);

    taskHandler.disconnectAll(peer.id);
  },
});
