import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["notifications:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
    },
    orderBy: {
      created: "desc", // Newest first
    },
  });

  return notifications;
});
