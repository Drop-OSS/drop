import type { Prisma } from "~/prisma/client";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
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

  const [id, options, pull, dump] = uploadResult;

  // handleFileUpload reads the rest of the options for us.
  const name = options.name;
  const description = options.description;
  const gameId = options.id;

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

  const newObject = await prisma.game.update({
    where: {
      id: gameId,
    },
    data: updateModel,
  });

  return newObject;
});
