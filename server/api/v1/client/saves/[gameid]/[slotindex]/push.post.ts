import { ClientCapabilities } from "@prisma/client";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import saveManager from "~/server/internal/saves";

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

    const slotIndexString = getRouterParam(h3, "slotindex");
    if (!slotIndexString)
      throw createError({
        statusCode: 400,
        statusMessage: "No slotIndex in route params",
      });
    const slotIndex = parseInt(slotIndexString);
    if (Number.isNaN(slotIndex))
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid slotIndex",
      });

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });
    if (!game)
      throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

    await saveManager.pushSave(
      gameId,
      user.id,
      slotIndex,
      h3.node.req,
      client.id,
    );

    return;
  },
);
