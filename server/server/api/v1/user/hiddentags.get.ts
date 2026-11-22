import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

// The ids of the tags this user has hidden from their game lists.
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hiddenTags: { select: { id: true } } },
  });
  return user?.hiddenTags.map((t) => t.id) ?? [];
});
