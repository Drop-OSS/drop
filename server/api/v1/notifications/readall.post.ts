import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["notifications:mark"]);
  if (!userId) throw createError({ statusCode: 403 });

  const acls = await aclManager.fetchAllACLs(h3);
  if (!acls)
    throw createError({
      statusCode: 500,
      statusMessage: "Got userId but no ACLs - what?",
    });

  await prisma.notification.updateMany({
    where: {
      userId,
      acls: {
        hasSome: acls,
      },
    },
    data: {
      read: true,
    },
  });

  return;
});
