import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["user:delete"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;

  const group = await prisma.userGroup.findUnique({ where: { id } });
  if (!group)
    throw createError({ statusCode: 404, message: "Group not found" });

  // SAFETY: existence verified above via findUnique
  // eslint-disable-next-line drop/no-prisma-delete
  await prisma.userGroup.delete({ where: { id } });

  return { success: true };
});
