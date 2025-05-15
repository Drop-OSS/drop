import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["notifications:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const acls = await aclManager.fetchAllACLs(h3);
  if (!acls)
    throw createError({
      statusCode: 500,
      statusMessage: "Got userId but no ACLs - what?",
    });

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      acls: {
        hasSome: acls,
      },
    },
    orderBy: {
      created: "desc", // Newest first
    },
  });

  return notifications;
});
