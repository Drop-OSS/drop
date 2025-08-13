import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Fetch all companies on this instance
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["company:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const companies = await prisma.company.findMany({});
  return companies;
});
