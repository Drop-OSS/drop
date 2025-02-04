import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const developers = await prisma.developer.findMany({
    include: {
      games: true,
    },
    orderBy: {
      games: {
        _count: "desc",
      },
    },
    take: 3,
  });

  return developers;
});
