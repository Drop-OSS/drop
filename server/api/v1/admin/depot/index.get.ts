import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["depot:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const depots = await prisma.depot.findMany({});

  return depots;
});
