import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["company:delete"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;

  const company = await prisma.company.deleteMany({ where: { id } });
  if (company.count == 0)
    throw createError({ statusCode: 404, message: "Company not found" });
  return;
});
