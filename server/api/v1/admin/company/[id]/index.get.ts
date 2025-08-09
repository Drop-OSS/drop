import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Fetch a company and its associations
 * @param id Company ID
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["company:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      published: {
        select: {
          id: true,
        },
      },
      developed: {
        select: {
          id: true,
        },
      },
    },
  });
  if (!company)
    throw createError({ statusCode: 404, statusMessage: "Company not found" });
  const games = await prisma.game.findMany({
    where: {
      OR: [
        {
          developers: {
            some: {
              id: company.id,
            },
          },
        },
        {
          publishers: {
            some: {
              id: company.id,
            },
          },
        },
      ],
    },
    distinct: ["id"],
  });
  const companyFlatten = {
    ...company,
    developed: company.developed.map((e) => e.id),
    published: company.published.map((e) => e.id),
  };
  return { company: companyFlatten, games };
});
