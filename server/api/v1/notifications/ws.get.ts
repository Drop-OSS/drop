import notificationSystem from "~/server/internal/notifications";
import aclManager from "~/server/internal/acls";
import { logger } from "~/server/internal/logging";

// TODO add web socket sessions for horizontal scaling
// Peer ID to user ID
const socketSessions = new Map<string, string>();

/**
 * Connect to a WebSocket to listen for notification pushes.
 *
 * Sends "unauthenticated" if authentication fails, otherwise JSON notifications.
 */
export default defineWebSocketHandler({
  async open(peer) {
    const h3 = { headers: peer.request?.headers ?? new Headers() };
    const userId = await aclManager.getUserIdACL(h3, ["notifications:listen"]);
    if (!userId) {
      peer.send("unauthenticated");
      return;
    }

    const acls = await aclManager.fetchAllACLs(h3);
    if (!acls) {
      peer.send("unauthenticated");
      return;
    }

    socketSessions.set(peer.id, userId);

    notificationSystem.listen(userId, acls, peer.id, (notification) => {
      peer.send(JSON.stringify(notification));
    });
  },
  async close(peer, _details) {
    const userId = socketSessions.get(peer.id);
    if (!userId) {
      logger.info(`skipping websocket close for ${peer.id}`);
      return;
    }

    notificationSystem.unlisten(userId, peer.id);
    notificationSystem.unlisten("system", peer.id); // In case we were listening as 'system'
    socketSessions.delete(peer.id);
  },
});
