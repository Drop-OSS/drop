import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import taskHandler from "~/server/internal/tasks";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:read",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  await taskHandler.runTaskGroupByName("cleanup:invitations");

  const invitations = await prisma.invitation.findMany({});
  return invitations;
});
