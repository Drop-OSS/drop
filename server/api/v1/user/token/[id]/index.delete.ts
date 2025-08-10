import { APITokenMode } from "~/prisma/client/enums";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Revoke token
 * @param id Token ID
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []); // No ACLs only allows session authentication
  if (!userId) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;

  const deleted = await prisma.aPIToken.delete({
    where: { id: id, userId: userId, mode: APITokenMode.User },
  })!;
  if (!deleted)
    throw createError({ statusCode: 404, statusMessage: "Token not found" });

  return;
});
