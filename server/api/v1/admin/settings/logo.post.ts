import aclManager from "~/server/internal/acls";
import { IMAGE_EXTENSIONS, isImageMimeType } from "~/server/internal/mimetypes";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["settings:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const form = await readMultipartFormData(h3);
  if (!form || !isImageMimeType(new Uint8Array(form[0].data).buffer)) {
    throw createError({
      statusCode: 400,
      message: `File is not an image. Supported file formats: ${IMAGE_EXTENSIONS.join(", ")}`,
    });
  }
  const result = await handleFileUpload(h3, {}, ["anonymous:read"], 1);
  if (!result)
    throw createError({
      statusCode: 400,
      message: "File upload required (multipart form)",
    });

  const [ids, , pull] = result;
  const id = ids.at(0);
  if (!id)
    throw createError({
      statusCode: 400,
      message: "Upload at least one file.",
    });

  await pull();

  return { id: id };
});
