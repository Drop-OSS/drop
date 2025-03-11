import { defineEventHandler, createError, readBody } from "h3";
import aclManager from "~/server/internal/acls";
import newsManager from "~/server/internal/news";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["news:create"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const form = await readMultipartFormData(h3);
  if (!form)
    throw createError({
      statusCode: 400,
      statusMessage: "This endpoint requires multipart form data.",
    });

  const uploadResult = await handleFileUpload(h3, {}, ["internal:read"]);
  if (!uploadResult)
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to upload file",
    });

  const [imageId, options, pull, dump] = uploadResult;

  const title = options.title;
  const description = options.description;
  const content = options.content;
  const tags = options.tags ? (JSON.parse(options.tags) as string[]) : [];

  if (!title || !description || !content)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing or invalid title, description or content.",
    });

  const article = await newsManager.create({
    title: title,
    description: description,
    content: content,

    tags: tags,

    image: imageId,
    authorId: "system",
  });

  await pull();

  return article;
});
