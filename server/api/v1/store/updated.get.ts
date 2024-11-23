import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
  if (!userId) throw createError({ statusCode: 403 });

  const versions = await prisma.gameVersion.findMany({
    select: {
      game: true,
      created: true,
      platform: true,
    },
    orderBy: {
      created: "desc",
    },
    take: 8,
  });

  return { versions };
});
