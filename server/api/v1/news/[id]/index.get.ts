import { defineEventHandler, createError } from "h3";
import aclManager from "~/server/internal/acls";
import newsManager from "~/server/internal/news";

/**
 * Fetch news article by ID
 * @param id Article ID
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["news:read"]);
  if (!userId)
    throw createError({
      statusCode: 403,
      statusMessage: "Requires authentication",
    });

  const id = getRouterParam(h3, "id")!;

  const news = await newsManager.fetchById(id);
  if (!news)
    throw createError({
      statusCode: 404,
      message: "News article not found",
    });

  return news;
});
