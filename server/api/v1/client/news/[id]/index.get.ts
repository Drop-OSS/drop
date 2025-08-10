import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import newsManager from "~/server/internal/news";

/**
 * Fetch new article by ID
 * @param id Article ID
 */
export default defineClientEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id")!;

  const news = await newsManager.fetchById(id);
  if (!news)
    throw createError({
      statusCode: 404,
      message: "News article not found",
    });

  return news;
});
