import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
  if (!userId) throw createError({ statusCode: 403 });

  const publishers = await prisma.publisher.findMany({
    include: {
      games: true,
    },
    orderBy: {
      games: {
        _count: "desc",
      },
    },
    take: 4,
  });

  return publishers;
});
