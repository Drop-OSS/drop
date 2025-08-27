import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const companyId = getRouterParam(h3, "id");
  if (!companyId)
    throw createError({
      statusCode: 400,
      message: "Missing gameId in route params (somehow...?)",
    });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company)
    throw createError({ statusCode: 404, message: "Company not found" });

  return { company };
});
