import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { convertIDsToPlatforms } from "~/server/internal/platform/link";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const gameId = getRouterParam(h3, "id");
  if (!gameId)
    throw createError({
      statusCode: 400,
      message: "Missing gameId in route params (somehow...?)",
    });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      versions: {
        include: {
          gameVersions: {
            include: {
              platform: true,
            },
          },
        },
      },
      publishers: {
        select: {
          id: true,
          mName: true,
          mShortDescription: true,
          mLogoObjectId: true,
        },
      },
      developers: {
        select: {
          id: true,
          mName: true,
          mShortDescription: true,
          mLogoObjectId: true,
        },
      },
      tags: true,
    },
  });

  if (!game) throw createError({ statusCode: 404, message: "Game not found" });

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

  const platformIDs = game.versions
    .map((e) => e.gameVersions)
    .flat()
    .map((e) => e.platform)
    .flat()
    .map((e) => e.id)
    .filter((e) => e !== null)
    .filter((v, index, arr) => arr.findIndex((k) => k == v) == index);

  const platforms = await convertIDsToPlatforms(platformIDs);

  const noVersionsGame = { ...game, versions: undefined };

  return { game: noVersionsGame, rating, platforms };
});
