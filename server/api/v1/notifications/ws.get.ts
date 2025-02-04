import notificationSystem from "~/server/internal/notifications";
import session from "~/server/internal/session";
import { parse as parseCookies } from "cookie-es";
import aclManager from "~/server/internal/acls";

// TODO add web socket sessions for horizontal scaling
// Peer ID to user ID
const socketSessions: { [key: string]: string } = {};

export default defineWebSocketHandler({
  async open(peer) {
    const userId = await aclManager.getUserIdACL(
      { headers: peer.request?.headers ?? new Headers() },
      ["notifications:listen"]
    );
    if (!userId) {
      peer.send("unauthenticated");
      return;
    }

    socketSessions[peer.id] = userId;

    notificationSystem.listen(userId, peer.id, (notification) => {
      peer.send(JSON.stringify(notification));
    });
  },
  async close(peer, details) {
    const userId = socketSessions[peer.id];
    if (!userId) {
      console.log(`skipping websocket close for ${peer.id}`);
      return;
    }

    notificationSystem.unlisten(userId, peer.id);
    delete socketSessions[peer.id];
  },
});
