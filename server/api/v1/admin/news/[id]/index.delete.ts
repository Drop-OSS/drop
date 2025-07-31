import { defineEventHandler, createError } from "h3";
import aclManager from "~/server/internal/acls";
import newsManager from "~/server/internal/news";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["news:delete"]);
  if (!allowed)
    throw createError({
      statusCode: 403,
    });

  const id = h3.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing news ID",
    });
  }

  await newsManager.delete(id);
  return { success: true };
});
