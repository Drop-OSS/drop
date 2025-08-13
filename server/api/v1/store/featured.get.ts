import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Fetch all featured games. Used for store carousel.
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const games = await prisma.game.findMany({
    where: {
      featured: true,
    },
    select: {
      id: true,
      mName: true,
      mShortDescription: true,
      mCoverObjectId: true,
      mBannerObjectId: true,
      developers: {
        select: {
          id: true,
          mName: true,
        },
      },
      publishers: {
        select: {
          id: true,
          mName: true,
        },
      },
    },
    orderBy: {
      created: "desc",
    },
  });

  return games;
});
