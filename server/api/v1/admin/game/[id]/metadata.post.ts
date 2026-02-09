import type { Prisma } from "~/prisma/client/client";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";
import { IMAGE_EXTENSIONS, isImageMimeType } from "~/server/internal/mimetypes";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const form = await readMultipartFormData(h3);
  if (!form || !isImageMimeType(new Uint8Array(form[0].data).buffer)) {
    throw createError({
      statusCode: 400,
      message: `File is not an image. Supported file formats: ${IMAGE_EXTENSIONS.join(", ")}`,
    });
  }

  const gameId = getRouterParam(h3, "id")!;

  const uploadResult = await handleFileUpload(h3, {}, ["internal:read"], 1);
  if (!uploadResult)
    throw createError({
      statusCode: 400,
      message: "Failed to upload file",
    });

  const [ids, options, pull, dump] = uploadResult;

  const id = ids.at(0);

  // handleFileUpload reads the rest of the options for us.
  const name = options.name;
  const description = options.description;

  const updateModel: Prisma.GameUpdateInput = {
    mName: name,
    mShortDescription: description,
  };

  // handle if user uploaded new icon
  if (id) {
    updateModel.mIconObjectId = id;
    await pull();
  } else {
    dump();
  }

  // If the API call doesn't provide values, don't set them
  for (const [key, value] of Object.entries(updateModel)) {
    if (value === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete updateModel[key as keyof typeof updateModel];
    }
  }

  const newObject = (
    await prisma.game.updateManyAndReturn({
      where: {
        id: gameId,
      },
      data: updateModel,
    })
  ).at(0);

  if (!newObject)
    throw createError({ statusCode: 404, message: "Game not found" });

  return newObject;
});
