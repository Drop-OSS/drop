import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

/**
 * Fetch game by ID
 * @param id Game ID
 */
export default defineClientEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id")!;

  const game = await prisma.game.findUnique({
    where: {
      id,
    },
  });
  if (!game)
    throw createError({ statusCode: 404, statusMessage: "Game not found" });

  return game;
});
