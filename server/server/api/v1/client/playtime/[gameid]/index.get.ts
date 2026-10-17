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
    const gameId = getRouterParam(h3, "gameid");
    if (!gameId)
      throw createError({
        statusCode: 400,
        statusMessage: "No gameID in route params",
      });

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });
    if (!game)
      throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

    const playtime = await prisma.playtime.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId: user.id,
        },
      },
    });
    if (!playtime)
      throw createError({
        statusCode: 404,
        statusMessage: "Playtime not found",
      });

    return playtime;
  },
);
