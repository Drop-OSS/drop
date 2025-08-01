import type { FetchError } from "ofetch";
import clientHandler from "~/server/internal/clients/handler";

export default defineWebSocketHandler({
  async open(peer) {
    try {
      const h3 = { headers: peer.request?.headers ?? new Headers() };
      const code = h3.headers.get("Authorization");
      if (!code)
        throw createError({
          statusCode: 400,
          statusMessage: "Code required in Authorization header.",
        });
      await clientHandler.connectCodeListener(code, peer);
    } catch (e) {
      peer.send(
        JSON.stringify({
          type: "error",
          value: (e as FetchError)?.statusMessage,
        }),
      );
      peer.close();
    }
  },
});
