import { H3Event } from "h3";
import session from "~/server/internal/session";
import { v4 as uuidv4 } from "uuid";
import taskHandler, { TaskMessage } from "~/server/internal/tasks";

export default defineWebSocketHandler({
  open(peer) {
    const dummyEvent = {
      node: {
        req: {
          headers: peer.headers,
        },
      },
    } as unknown as H3Event;
    const userId = session.getUserId(dummyEvent);
    if (!userId) {
      peer.send("unauthenticated");
      return;
    }
    const admin = session.getAdminUser(dummyEvent);
    const peerId = uuidv4();
    peer.ctx.id = peerId;
    peer.ctx.admin = admin !== undefined;

    const rtMsg: TaskMessage = {
      id: "connect",
      success: true,
      progress: 0,
      error: undefined,
      log: [],
    };
    peer.send(rtMsg);
  },
  message(peer, message) {
    if (!peer.ctx.id) return;
    const text = message.text();
    if (text.startsWith("connect/")) {
      const id = text.substring("connect/".length);
      taskHandler.connect(peer.ctx.id, id, peer, peer.ctx.admin);
      return;
    }
  },
  close(peer, details) {
    if (!peer.ctx.id) return;
  },
});
