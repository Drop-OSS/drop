import pluginManager from "~/server/internal/plugins";
import { PluginWebSocketGateway } from "~/server/internal/plugins/ws-gateway";

const gateway = new PluginWebSocketGateway(pluginManager);

export default defineWebSocketHandler({
  open: (peer) => gateway.open(peer),
  message: (peer, message) => gateway.message(peer, message),
  close: (peer) => gateway.close(peer),
});
