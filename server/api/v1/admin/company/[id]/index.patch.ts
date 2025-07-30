import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["company:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const id = getRouterParam(h3, "id")!;

  const restOfTheBody = { ...body };
  delete restOfTheBody["id"];

  const newObj = await prisma.company.update({
    where: {
      id: id,
    },
    data: restOfTheBody,
    // I would put a select here, but it would be based on the body, and muck up the types
  });

  return newObj;
});
