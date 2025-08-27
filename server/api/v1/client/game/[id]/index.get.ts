import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({ statusCode: 400, message: "No ID in route" });

  const game = await prisma.game.findUnique({
    where: {
      id,
    },
  });
  if (!game)
    throw createError({ statusCode: 404, message: "Game not found" });

  return game;
});
