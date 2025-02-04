import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserACL(h3, ["store:read"]);
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
