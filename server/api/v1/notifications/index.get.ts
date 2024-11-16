import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
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
