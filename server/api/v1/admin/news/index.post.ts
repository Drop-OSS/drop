import { defineEventHandler, createError, readBody } from "h3";
import aclManager from "~/server/internal/acls";
import newsManager from "~/server/internal/news";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["news:create"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);

  const article = await newsManager.create({
    title: body.title,
    description: body.description,
    content: body.content,

    tags: body.tags,

    image: body.image,
    authorId: body.authorId,
  });

  return article;
});
