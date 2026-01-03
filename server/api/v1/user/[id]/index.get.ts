import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const requestingUser = await aclManager.getUserACL(h3, ["read"]);
  if (!requestingUser) throw createError({ statusCode: 403 });

  const userId = getRouterParam(h3, "id");
  if (!userId)
    throw createError({
      statusCode: 400,
      statusMessage: "No userId in route.",
    });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      profilePictureObjectId: true,
    },
  });

  if (!user)
    throw createError({ statusCode: 404, statusMessage: "User not found." });

  return user;
});
