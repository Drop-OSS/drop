import { ClientCapabilities } from "~/prisma/client/enums";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    if (!client.capabilities.includes(ClientCapabilities.TrackPlaytime))
      throw createError({
        statusCode: 403,
        statusMessage: "Capability not allowed.",
      });
    const user = await fetchUser();

    const playtimes = await prisma.playtime.findMany({
      where: {
        userId: user.id,
      },
    });

    return playtimes;
  },
);
