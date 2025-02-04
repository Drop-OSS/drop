import { defineEventHandler, createError } from "h3";
import newsManager from "~/server/internal/news";

export default defineEventHandler(async (event) => {
  const userId = await event.context.session.getUserId(event);
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing news ID",
    });
  }

  await newsManager.delete(id);
  return { success: true };
}); 
