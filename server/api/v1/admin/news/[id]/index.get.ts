import { defineEventHandler, createError } from "h3";
import aclManager from "~/server/internal/acls";
import newsManager from "~/server/internal/news";

/**
 * Fetch a single news article
 * @param id Article ID
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["news:read"]);
  if (!allowed)
    throw createError({
      statusCode: 403,
    });

  const id = h3.context.params?.id;
  if (!id)
    throw createError({
      statusCode: 400,
      message: "Missing news ID",
    });

  const news = await newsManager.fetchById(id);
  if (!news)
    throw createError({
      statusCode: 404,
      message: "News article not found",
    });

  return news;
});
