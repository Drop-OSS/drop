import { ClientCapabilities } from "~/prisma/client";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import headscaleManager from "~/server/internal/p2p/headscale";

export default defineClientEventHandler(async (h3, { fetchClient }) => {
  const client = await fetchClient();
  if (!client.capabilities.includes(ClientCapabilities.PeerAPI))
    throw createError({
      statusCode: 403,
      statusMessage: "Capability not allowed.",
    });

  if (!headscaleManager.enabled())
    throw createError({
      statusCode: 500,
      statusMessage: "Peer network not available.",
    });

  return headscaleManager.configuration();
});
