import { ClientCapabilities } from "~/prisma/client/enums";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    if (!client.capabilities.includes(ClientCapabilities.CloudSaves))
      throw createError({
        statusCode: 403,
        message: "Capability not allowed.",
      });
    const user = await fetchUser();
    const gameId = getRouterParam(h3, "gameid");
    if (!gameId)
      throw createError({
        statusCode: 400,
        message: "No gameID in route params",
      });

    const slotIndexString = getRouterParam(h3, "slotindex");
    if (!slotIndexString)
      throw createError({
        statusCode: 400,
        message: "No slotIndex in route params",
      });
    const slotIndex = parseInt(slotIndexString);
    if (Number.isNaN(slotIndex))
      throw createError({
        statusCode: 400,
        message: "Invalid slotIndex",
      });

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });
    if (!game)
      throw createError({ statusCode: 400, message: "Invalid game ID" });

    const save = await prisma.saveSlot.delete({
      where: {
        id: {
          userId: user.id,
          gameId: gameId,
          index: slotIndex,
        },
      },
    });
    if (!save)
      throw createError({ statusCode: 404, message: "Save not found" });
  },
);
