import aclManager from "~/server/internal/acls";
import { systemConfig } from "~/server/internal/config/sys-conf";
import prisma from "~/server/internal/db/database";
import taskHandler from "~/server/internal/tasks";

/**
 * Fetches a "Simple" invitation
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:read",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  await taskHandler.runTaskGroupByName("cleanup:invitations");

  const externalUrl = systemConfig.getExternalUrl();
  const invitations = await prisma.invitation.findMany({});

  return invitations.map((invitation) => {
    return {
      ...invitation,
      inviteUrl: `${externalUrl}/auth/register?id=${invitation.id}`,
    };
  });
});
