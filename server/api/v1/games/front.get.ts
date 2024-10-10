import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
  if (!userId) throw createError({ statusCode: 403 });

  const rawGames = await prisma.game.findMany({
    select: {
      id: true,
      mName: true,
      mShortDescription: true,
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
      versions: {
        select: {
          platform: true,
        },
      },
    },
  });

  const games = rawGames.map((e) => ({...e, platforms: e.versions.map((e) => e.platform).filter((e, _, r) => !r.includes(e))}))

  return games;
});
