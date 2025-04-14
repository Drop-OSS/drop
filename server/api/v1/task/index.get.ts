import session from "~/server/internal/session";
import taskHandler, { TaskMessage } from "~/server/internal/tasks";
import { parse as parseCookies } from "cookie-es";
import type { MinimumRequestObject } from "~/server/h3";

// TODO add web socket sessions for horizontal scaling
// ID to admin
const socketHeaders: { [key: string]: MinimumRequestObject } = {};

export default defineWebSocketHandler({
  async open(peer) {
    const request = peer.request;
    if (!request) {
      peer.send("unauthenticated");
      return;
    }

    socketHeaders[peer.id] = {
      headers: request.headers ?? new Headers(),
    };
    peer.send(`connect`);
  },
  message(peer, message) {
    if (!peer.id) return;
    if (socketHeaders[peer.id] === undefined) return;
    const text = message.text();
    if (text.startsWith("connect/")) {
      const id = text.substring("connect/".length);
      taskHandler.connect(peer.id, id, peer, socketHeaders[peer.id]);
      return;
    }
  },
  close(peer, details) {
    if (!peer.id) return;
    if (socketHeaders[peer.id] === undefined) return;
    delete socketHeaders[peer.id];

    taskHandler.disconnectAll(peer.id);
  },
});
