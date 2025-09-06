import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["notifications:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const notificationId = getRouterParam(h3, "id");
  if (!notificationId)
    throw createError({
      statusCode: 400,
      message: "Missing notification ID",
    });

  const userIds = [userId];
  const hasSystemPerms = await aclManager.allowSystemACL(h3, [
    "notifications:read",
  ]);
  if (hasSystemPerms) {
    userIds.push("system");
  }

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: { in: userIds },
    },
  });

  if (!notification)
    throw createError({
      statusCode: 400,
      message: "Invalid notification ID",
    });

  return notification;
});
