import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["notifications:delete"]);
  if (!userId) throw createError({ statusCode: 403 });

  const notificationId = getRouterParam(h3, "id");
  if (!notificationId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing notification ID",
    });

  const notification = await prisma.notification.delete({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid notification ID",
    });

  return {};
});
