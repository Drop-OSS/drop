import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const games = await prisma.game.findMany({
    orderBy: {
      mReleased: "desc",
    },
    take: 12,
  });

  return games;
});
