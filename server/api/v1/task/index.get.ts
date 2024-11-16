import { H3Event } from "h3";
import session from "~/server/internal/session";
import { v4 as uuidv4 } from "uuid";
import taskHandler, { TaskMessage } from "~/server/internal/tasks";

// TODO add web socket sessions for horizontal scaling
// ID to admin
const adminSocketSessions: { [key: string]: boolean } = {};

export default defineWebSocketHandler({
  open(peer) {
    const dummyEvent = {
      node: {
        req: {
          headers: peer.request?.headers,
        },
      },
    } as unknown as H3Event;
    const userId = session.getUserId(dummyEvent);
    if (!userId) {
      peer.send("unauthenticated");
      return;
    }
    const admin = session.getAdminUser(dummyEvent);
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
