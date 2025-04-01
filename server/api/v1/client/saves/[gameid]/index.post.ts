import { ClientCapabilities } from "@prisma/client";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { applicationSettings } from "~/server/internal/config/application-configuration";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    if (!client.capabilities.includes(ClientCapabilities.CloudSaves))
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

    const saves = await prisma.saveSlot.findMany({
      where: {
        userId: user.id,
        gameId: gameId,
      },
      orderBy: {
        index: "asc",
      },
    });

    const limit = await applicationSettings.get("saveSlotCountLimit");
    if (saves.length + 1 > limit)
      throw createError({
        statusCode: 400,
        statusMessage: "Out of save slots",
      });

    let firstIndex = 0;
    for (const save of saves) {
      if (firstIndex == save.index) firstIndex++;
    }

    const newSlot = await prisma.saveSlot.create({
      data: {
        userId: user.id,
        gameId: gameId,
        index: firstIndex,
        lastUsedClientId: client.id,
      },
    });

    return newSlot;
  }
);
