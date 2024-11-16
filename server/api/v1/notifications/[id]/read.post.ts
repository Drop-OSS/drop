import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
  if (!userId) throw createError({ statusCode: 403 });

  const notificationId = getRouterParam(h3, "id");
  if (!notificationId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing notification ID",
    });

  const notification = await prisma.notification.update({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      read: true,
    },
  });

  if (!notification)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid notification ID",
    });

  return notification;
});
