import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import objectHandler from "~/server/internal/objects";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:image:delete"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const gameId = body.gameId;
  const imageId = body.imageId;

  if (!gameId || !imageId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing gameId or imageId in body",
    });

  const game = await prisma.game.findUnique({
    where: {
      id: gameId,
    },
    select: {
      mBannerObjectId: true,
      mImageLibraryObjectIds: true,
      mCoverObjectId: true,
    },
  });

  if (!game)
    throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

  const imageIndex = game.mImageLibraryObjectIds.findIndex((e) => e == imageId);
  if (imageIndex == -1)
    throw createError({ statusCode: 400, statusMessage: "Image not found" });

  game.mImageLibraryObjectIds.splice(imageIndex, 1);
  await objectHandler.deleteAsSystem(imageId);

  if (game.mBannerObjectId === imageId) {
    game.mBannerObjectId = game.mImageLibraryObjectIds[0];
  }
  if (game.mCoverObjectId === imageId) {
    game.mCoverObjectId = game.mImageLibraryObjectIds[0];
  }

  const result = await prisma.game.update({
    where: {
      id: gameId,
    },
    data: {
      mBannerObjectId: game.mBannerObjectId,
      mImageLibraryObjectIds: game.mImageLibraryObjectIds,
      mCoverObjectId: game.mCoverObjectId,
    },
    select: {
      mBannerObjectId: true,
      mImageLibraryObjectIds: true,
      mCoverObjectId: true,
    },
  });

  return result;
});
