import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { AuthMec } from "~/prisma/client/enums";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []); // No ACLs only allows session authentication
  if (!userId) throw createError({ statusCode: 403 });

  const authMecs = await prisma.linkedAuthMec.findMany({
    where: {
      userId,
    },
    omit: {
      credentials: true,
    },
  });
  const authMecMap = Object.fromEntries(authMecs.map((v) => [v.mec, v]));
  return { mecs: authMecMap, available: Object.keys(AuthMec) };
});
