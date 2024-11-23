import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
  if (!userId) throw createError({ statusCode: 403 });

  const games = await prisma.game.findMany({
    select: {
      id: true,
      mName: true,
      mShortDescription: true,
      mCoverId: true,
      mBannerId: true,
      mDevelopers: {
        select: {
          id: true,
          mName: true,
        },
      },
      mPublishers: {
        select: {
          id: true,
          mName: true,
        },
      },
    },
    orderBy: {
      created: "desc",
    },
    take: 8,
  });

  return games;
});
