import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const id = body.id;
  if (!id)
    throw createError({ statusCode: 400, statusMessage: "Missing id in body" });

  const restOfTheBody = { ...body };
  delete restOfTheBody["id"];

  const newObj = await prisma.game.update({
    where: {
      id: id,
    },
    data: restOfTheBody,
    // I would put a select here, but it would be based on the body, and muck up the types
  });

  return newObj;
});
