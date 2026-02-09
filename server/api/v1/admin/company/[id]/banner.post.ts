import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { IMAGE_EXTENSIONS, isImageMimeType } from "~/server/internal/mimetypes";
import objectHandler from "~/server/internal/objects";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["company:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const companyId = getRouterParam(h3, "id")!;
  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
  });

  if (!company)
    throw createError({ statusCode: 400, message: "Invalid company id" });

  const formData = await readMultipartFormData(h3);
  if (!formData) {
    throw createError({ statusCode: 400, message: "No file detected" });
  }
  const buffer = new Uint8Array(formData[0].data).buffer;
  if (!isImageMimeType(buffer)) {
    throw createError({
      statusCode: 400,
      message: `File is not an image. Supported file formats: ${IMAGE_EXTENSIONS.join(", ")}`,
    });
  }

  const result = await handleFileUpload(h3, {}, ["internal:read"], 1);
  if (!result)
    throw createError({
      statusCode: 400,
      message: "File upload required (multipart form)",
    });

  const [ids, , pull, dump] = result;
  const id = ids.at(0);
  if (!id)
    throw createError({
      statusCode: 400,
      message: "Upload at least one file.",
    });

  await objectHandler.deleteAsSystem(company.mBannerObjectId);
  const { count } = await prisma.company.updateMany({
    where: {
      id: companyId,
    },
    data: {
      mBannerObjectId: id,
    },
  });
  if (count == 0) {
    dump();
    throw createError({ statusCode: 404, message: "Company not found" });
  }
  await pull();

  return { id: id };
});
