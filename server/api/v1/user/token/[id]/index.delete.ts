import { APITokenMode } from "~/prisma/client";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []); // No ACLs only allows session authentication
  if (!userId) throw createError({ statusCode: 403 });

  const id = h3.context.params?.id;
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "No id in router params",
    });

  const deleted = await prisma.aPIToken.delete({
    where: { id: id, userId: userId, mode: APITokenMode.User },
  })!;
  if (!deleted)
    throw createError({ statusCode: 404, statusMessage: "Token not found" });

  return;
});
