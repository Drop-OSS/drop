import systemManager from "~/server/internal/system-data";
import aclManager from "~/server/internal/acls";
import { logger } from "~/server/internal/logging";

// TODO add web socket sessions for horizontal scaling
// Peer ID to user ID
const socketSessions = new Map<string, string>();

export default defineWebSocketHandler({
  async open(peer) {
    const h3 = { headers: peer.request?.headers ?? new Headers() };
    const userId = await aclManager.getUserIdACL(h3, ["system-data:listen"]);
    if (!userId) {
      peer.send("unauthenticated");
      return;
    }

    socketSessions.set(peer.id, userId);

    systemManager.listen(userId, peer.id, (systemData) => {
      peer.send(JSON.stringify(systemData));
    });
  },

  async close(peer, _details) {
    const userId = socketSessions.get(peer.id);
    if (!userId) {
      logger.info(`skipping websocket close for ${peer.id}`);
      return;
    }

    systemManager.unlisten(userId, peer.id);
    systemManager.unlisten("system", peer.id); // In case we were listening as 'system'
    socketSessions.delete(peer.id);
  },
});
