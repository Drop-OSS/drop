import { defineEventHandler, createError } from "h3";
import newsManager from "~/server/internal/news";

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing news ID",
    });
  }

  const news = await newsManager.getById(id);
  if (!news) {
    throw createError({
      statusCode: 404,
      message: "News article not found",
    });
  }

  return news;
}); 
