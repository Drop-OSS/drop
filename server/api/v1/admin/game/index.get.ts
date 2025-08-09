import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Fetch brief metadata on all games connected to this instance
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  return await prisma.game.findMany({
    select: {
      id: true,
      mName: true,
      mShortDescription: true,
      mIconObjectId: true,
    },
  });
});
