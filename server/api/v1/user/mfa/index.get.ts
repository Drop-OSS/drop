import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/enums";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []); // No ACLs only allows session authentication
  if (!userId) throw createError({ statusCode: 403 });

  const mfaMecs = await prisma.linkedMFAMec.findMany({
    where: {
      userId,
    },
    omit: {
      credentials: true,
    },
  });
  const mfaMecMap = Object.fromEntries(mfaMecs.map((v) => [v.mec, v]));
  return { mecs: mfaMecMap, available: Object.keys(MFAMec) };
});
