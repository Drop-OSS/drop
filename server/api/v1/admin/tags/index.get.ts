import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Fetch all game tags
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["tags:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const tags = await prisma.gameTag.findMany({ orderBy: { name: "asc" } });
  return tags;
});
