import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const tagId = getRouterParam(h3, "id");
  if (!tagId)
    throw createError({
      statusCode: 400,
      message: "Missing gameId in route params (somehow...?)",
    });

  const tag = await prisma.gameTag.findUnique({
    where: { id: tagId },
  });

  if (!tag)
    throw createError({ statusCode: 404, message: "Tag not found" });

  return { tag };
});
