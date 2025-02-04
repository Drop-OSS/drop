import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:delete",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const id = body.id;
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "id required for deletion",
    });

  await prisma.invitation.delete({ where: { id: id } });
  return {};
});
