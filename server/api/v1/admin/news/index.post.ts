import { ArkErrors, type } from "arktype";
import { defineEventHandler, createError } from "h3";
import aclManager from "~/server/internal/acls";
import newsManager from "~/server/internal/news";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";

const CreateNews = type({
  title: "string",
  description: "string",
  content: "string",
  tags: "string = '[]'",
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["news:create"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const form = await readMultipartFormData(h3);
  if (!form)
    throw createError({
      statusCode: 400,
      statusMessage: "This endpoint requires multipart form data.",
    });

  const uploadResult = await handleFileUpload(h3, {}, ["internal:read"], 1);
  if (!uploadResult)
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to upload file",
    });

  const [imageIds, options, pull, _dump] = uploadResult;

  const body = await CreateNews(options);
  if (body instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: body.summary });

  const parsedTags = JSON.parse(body.tags);
  if (typeof parsedTags !== "object" || !Array.isArray(parsedTags))
    throw createError({
      statusCode: 400,
      statusMessage: "Tags must be an array",
    });

  const imageId = imageIds.at(0);

  const article = await newsManager.create({
    title: body.title,
    description: body.description,
    content: body.content,

    tags: parsedTags,

    ...(imageId && { image: imageId }),
    authorId: "system",
  });

  await pull();

  return article;
});
