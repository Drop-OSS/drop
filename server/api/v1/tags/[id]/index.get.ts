import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Fetch tag by ID
 * @param id Tag ID
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const tagId = getRouterParam(h3, "id")!;

  const tag = await prisma.gameTag.findUnique({
    where: { id: tagId },
  });

  if (!tag)
    throw createError({ statusCode: 404, statusMessage: "Tag not found" });

  return { tag };
});
