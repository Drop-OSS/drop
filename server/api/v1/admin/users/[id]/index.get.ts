import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["user:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const userId = getRouterParam(h3, "id");
  if (!userId)
    throw createError({
      statusCode: 400,
      statusMessage: "No userId in route.",
    });

  if (userId == "system")
    throw createError({
      statusCode: 400,
      statusMessage: "Cannot delete system user.",
    });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    throw createError({ statusCode: 404, statusMessage: "User not found." });

  return user;
});
