import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["redist:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  return await prisma.redist.findMany({
    select: {
      id: true,
      mName: true,
      mShortDescription: true,
      mIconObjectId: true,
    },
  });
});
