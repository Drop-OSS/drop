import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const gameId = getRouterParam(h3, "id");
  if (!gameId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing gameId in route params (somehow...?)",
    });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      versions: true,
    },
  });

  if (!game)
    throw createError({ statusCode: 404, statusMessage: "Game not found" });

  const rating = await prisma.gameRating.aggregate({
    where: {
      gameId: game.id,
    },
    _avg: {
      mReviewRating: true,
    },
    _sum: {
      mReviewCount: true,
    },
  });

  return { game, rating };
});
