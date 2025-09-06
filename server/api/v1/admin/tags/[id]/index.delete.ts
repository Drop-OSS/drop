import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["tags:delete"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;

  const tag = await prisma.gameTag.deleteMany({ where: { id } });
  if (tag.count == 0)
    throw createError({ statusCode: 404, message: "Tag not found" });
  return;
});
