import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["notifications:mark"]);
  if (!userId) throw createError({ statusCode: 403 });

  await prisma.notification.updateMany({
    where: {
      userId,
    },
    data: {
      read: true,
    },
  });

  return;
});
