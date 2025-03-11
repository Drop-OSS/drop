import notificationSystem from "~/server/internal/notifications";
import session from "~/server/internal/session";
import { parse as parseCookies } from "cookie-es";
import aclManager from "~/server/internal/acls";

// TODO add web socket sessions for horizontal scaling
// Peer ID to user ID
const socketSessions: { [key: string]: string } = {};

export default defineWebSocketHandler({
  async open(peer) {
    const h3 = { headers: peer.request?.headers ?? new Headers() };
    const userId = await aclManager.getUserIdACL(h3, ["notifications:listen"]);
    if (!userId) {
      peer.send("unauthenticated");
      return;
    }

    const userIds = [userId];

    const hasSystemPerms = await aclManager.allowSystemACL(h3, [
      "notifications:listen",
    ]);
    if (hasSystemPerms) {
      userIds.push("system");
    }

    socketSessions[peer.id] = userId;

    for (const listenUserId of userIds) {
      notificationSystem.listen(listenUserId, peer.id, (notification) => {
        peer.send(JSON.stringify(notification));
      });
    }
  },
  async close(peer, details) {
    const userId = socketSessions[peer.id];
    if (!userId) {
      console.log(`skipping websocket close for ${peer.id}`);
      return;
    }

    notificationSystem.unlisten(userId, peer.id);
    notificationSystem.unlisten("system", peer.id); // In case we were listening as 'system'
    delete socketSessions[peer.id];
  },
});
