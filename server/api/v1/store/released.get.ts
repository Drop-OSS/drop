import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
  if (!userId) throw createError({ statusCode: 403 });

  const games = await prisma.game.findMany({
    orderBy: {
      mReleased: "desc",
    },
    take: 12,
  });

  return games;
});
