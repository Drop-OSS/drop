import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["redist:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);

  const id = body.id;
  if (!id || typeof id !== "string")
    throw createError({ statusCode: 400, message: "ID required in body." });

  const updateParams = body;
  delete updateParams["id"];

  try {
    return await prisma.redist.update({
      where: {
        id,
      },
      data: updateParams,
    });
  } catch (e) {
    throw createError({ statusCode: 400, message: (e as string)?.toString() });
  }
});
