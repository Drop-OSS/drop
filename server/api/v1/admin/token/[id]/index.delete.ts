import { APITokenMode } from "~/prisma/client/enums";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, []); // No ACLs only allows session authentication
  if (!allowed) throw createError({ statusCode: 403 });

  const id = h3.context.params?.id;
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "No id in router params",
    });

  const { count } = await prisma.aPIToken.deleteMany({
    where: { id: id, mode: APITokenMode.System },
  })!;
  if (count == 0)
    throw createError({ statusCode: 404, statusMessage: "Token not found" });

  return;
});
