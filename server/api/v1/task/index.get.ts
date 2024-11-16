import session from "~/server/internal/session";
import taskHandler, { TaskMessage } from "~/server/internal/tasks";
import { parse as parseCookies } from "cookie-es";

// TODO add web socket sessions for horizontal scaling
// ID to admin
const adminSocketSessions: { [key: string]: boolean } = {};

export default defineWebSocketHandler({
  async open(peer) {
    const cookies = peer.request?.headers?.get("Cookie");
    if (!cookies) {
      peer.send("unauthenticated");
      return;
    }

    const parsedCookies = parseCookies(cookies);
    const token = parsedCookies[session.getDropTokenCookie()];

    const userId = await session.getUserIdRaw(token);
    if (!userId) {
      peer.send("unauthenticated");
      return;
    }

    const admin = session.getAdminUser(token);
    adminSocketSessions[peer.id] = admin !== undefined;

    const rtMsg: TaskMessage = {
      id: "connect",
      name: "Connect",
      success: true,
      progress: 0,
      error: undefined,
      log: [],
    };
    peer.send(JSON.stringify(rtMsg));
  },
  message(peer, message) {
    if (!peer.id) return;
    if (adminSocketSessions[peer.id] === undefined) return;
    const text = message.text();
    if (text.startsWith("connect/")) {
      const id = text.substring("connect/".length);
      taskHandler.connect(peer.id, id, peer, adminSocketSessions[peer.id]);
      return;
    }
  },
  close(peer, details) {
    if (!peer.id) return;
    if (adminSocketSessions[peer.id] === undefined) return;
    delete adminSocketSessions[peer.id];

    taskHandler.disconnectAll(peer.id);
  },
});
