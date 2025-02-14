import { APITokenMode } from "@prisma/client";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []); // No ACLs only allows session authentication
  if (!userId) throw createError({ statusCode: 403 });

  const tokens = await prisma.aPIToken.findMany({
    where: { userId: userId, mode: APITokenMode.User },
    omit: { token: true },
  });

  return tokens;
});
