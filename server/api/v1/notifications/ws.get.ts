import notificationSystem from "~/server/internal/notifications";
import aclManager from "~/server/internal/acls";
import cacheHandler from "~/server/internal/cache";

// Peer ID to user ID
const socketSessions = cacheHandler.createCache<string>("notificationSocketSessions");

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

    await socketSessions.set(peer.id, userId);

    for (const listenUserId of userIds) {
      notificationSystem.listen(listenUserId, peer.id, (notification) => {
        peer.send(JSON.stringify(notification));
      });
    }
  },
  async close(peer, _details) {
    const userId = await socketSessions.get(peer.id);
    if (!userId) {
      console.log(`skipping websocket close for ${peer.id}`);
      return;
    }

    notificationSystem.unlisten(userId, peer.id);
    notificationSystem.unlisten("system", peer.id); // In case we were listening as 'system'
    await socketSessions.remove(peer.id);
  },
});
