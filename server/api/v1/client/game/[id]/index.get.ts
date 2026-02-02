import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id");
  console.log("[DEBUG] /api/v1/client/game/[id] called with ID:", id);
  if (!id)
    throw createError({ statusCode: 400, statusMessage: "No ID in route" });

  const game = await prisma.game.findUnique({
    where: {
      id,
    },
  });
  console.log("[DEBUG] Game lookup result:", game ? "FOUND" : "NOT FOUND");
  if (!game)
    throw createError({ statusCode: 404, statusMessage: "Game not found" });

  return game;
});
