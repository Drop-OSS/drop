import { defineEventHandler, createError } from "h3";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["user:delete"]);
  if (!allowed)
    throw createError({
      statusCode: 403,
    });

  const userId = h3.context.params?.id;
  if (!userId) {
    throw createError({
      statusCode: 400,
      message: "No userId in route.",
    });
  }
  if (userId === "system")
    throw createError({
      statusCode: 400,
      message: "Cannot interact with system user.",
    });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    throw createError({ statusCode: 404, message: "User not found." });

  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
});
