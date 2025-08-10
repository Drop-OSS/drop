import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Fetch company by ID
 * @param id Company ID
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const companyId = getRouterParam(h3, "id")!;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company)
    throw createError({ statusCode: 404, statusMessage: "Company not found" });

  return { company };
});
