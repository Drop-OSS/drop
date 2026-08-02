import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["user:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;

  const group = await prisma.userGroup.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      bannedAgeRatings: true,
    },
  });

  if (!group)
    throw createError({ statusCode: 404, message: "Group not found" });

  return group;
});
