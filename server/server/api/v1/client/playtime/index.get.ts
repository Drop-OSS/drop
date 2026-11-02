import { ClientCapabilities } from "~/prisma/client/enums";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import { getProfile } from "~/server/internal/profiles/http";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    if (!client.capabilities.includes(ClientCapabilities.TrackPlaytime))
      throw createError({
        statusCode: 403,
        statusMessage: "Capability not allowed.",
      });
    const user = await fetchUser();
    const profile = await getProfile(h3, user.id);

    const playtimes = await prisma.playtime.findMany({
      where: {
        userId: user.id,
        profileId: profile.id,
      },
    });

    return playtimes;
  },
);
