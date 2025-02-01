import { defineEventHandler, createError, readBody } from "h3";
import newsManager from "~/server/internal/news";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (!body.authorId) {
    throw createError({
      statusCode: 400,
      message: 'Author ID is required'
    });
  }

  const article = await newsManager.create({
    title: body.title,
    content: body.content,
    excerpt: body.excerpt,
    tags: body.tags,
    image: body.image,
    authorId: body.authorId,
  });

  return article;
});
