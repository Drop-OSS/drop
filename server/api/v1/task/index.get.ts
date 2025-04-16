import taskHandler from "~/server/internal/tasks";
import type { MinimumRequestObject } from "~/server/h3";

// TODO add web socket sessions for horizontal scaling
// ID to admin
const socketHeaders = new Map<string, MinimumRequestObject>();

export default defineWebSocketHandler({
  async open(peer) {
    const request = peer.request;
    if (!request) {
      peer.send("unauthenticated");
      return;
    }

    socketHeaders.set(peer.id, {
      headers: request.headers ?? new Headers(),
    });
    peer.send(`connect`);
  },
  message(peer, message) {
    if (!peer.id) return;
    const headers = socketHeaders.get(peer.id);
    if (headers === undefined) return;
    const text = message.text();
    if (text.startsWith("connect/")) {
      const id = text.substring("connect/".length);
      taskHandler.connect(peer.id, id, peer, headers);
      return;
    }
  },
  close(peer, _details) {
    if (!peer.id) return;
    if (!socketHeaders.has(peer.id)) return;
    socketHeaders.delete(peer.id);

    taskHandler.disconnectAll(peer.id);
  },
});
