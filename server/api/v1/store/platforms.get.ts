import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const platforms = await prisma.userPlatform.findMany({
    orderBy: { platformName: "asc" },
    select: {
      id: true,
      platformName: true,
    },
  });
  return platforms;
});
