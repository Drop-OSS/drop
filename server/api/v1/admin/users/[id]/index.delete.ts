import { defineEventHandler, createError } from "h3";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import userStatsManager from "~/server/internal/userstats";

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
      statusMessage: "Cannot interact with system user.",
    });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    throw createError({ statusCode: 404, statusMessage: "User not found." });

  // eslint-disable-next-line drop/no-prisma-delete
  await prisma.user.delete({ where: { id: userId } });
  await userStatsManager.deleteUser();
  return { success: true };
});
