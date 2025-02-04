import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "game:image:delete",
  ]);
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
      mBannerId: true,
      mImageLibrary: true,
      mCoverId: true,
    },
  });

  if (!game)
    throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

  const imageIndex = game.mImageLibrary.findIndex((e) => e == imageId);
  if (imageIndex == -1)
    throw createError({ statusCode: 400, statusMessage: "Image not found" });

  game.mImageLibrary.splice(imageIndex, 1);
  await h3.context.objects.delete(imageId);
  
  if (game.mBannerId === imageId) {
    game.mBannerId = game.mImageLibrary[0];
  }
  if (game.mCoverId === imageId) {
    game.mCoverId = game.mImageLibrary[0];
  }

  const result = await prisma.game.update({
    where: {
      id: gameId,
    },
    data: {
      mBannerId: game.mBannerId,
      mImageLibrary: game.mImageLibrary,
      mCoverId: game.mCoverId,
    },
    select: {
      mBannerId: true,
      mImageLibrary: true,
      mCoverId: true,
    },
  });

  return result;
});
