import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import newsManager from "~/server/internal/news";

export default defineClientEventHandler(async (h3) => {
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
