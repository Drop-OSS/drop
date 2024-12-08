import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
  if (!userId) throw createError({ statusCode: 403 });

  const versions = await prisma.gameVersion.findMany({
    where: {
      versionIndex: {
        gte: 1,
      },
    },
    select: {
      game: true,
    },
    orderBy: {
      created: "desc",
    },
    take: 12,
  });

  const games = versions
    .map((e) => e.game)
    .filter((v, i, a) => a.findIndex((e) => e.id === v.id) === i);

  return games;
});