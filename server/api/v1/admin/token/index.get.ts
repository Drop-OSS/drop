import { APITokenMode } from "~/prisma/client/enums";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, []); // No ACLs only allows session authentication
  if (!allowed) throw createError({ statusCode: 403 });

  const tokens = await prisma.aPIToken.findMany({
    where: { mode: APITokenMode.System },
    omit: { token: true },
  });

  return tokens;
});
