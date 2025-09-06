import { ArkErrors, type } from "arktype";
import type { Prisma } from "~/prisma/client/client";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";

const UpdateMetadata = type({
  name: "string?",
  description: "string?",
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const form = await readMultipartFormData(h3);
  if (!form)
    throw createError({
      statusCode: 400,
      message: "This endpoint requires multipart form data.",
    });

  const gameId = getRouterParam(h3, "id")!;

  const uploadResult = await handleFileUpload(h3, {}, ["internal:read"], 1);
  if (!uploadResult)
    throw createError({
      statusCode: 400,
      message: "Failed to upload file",
    });

  const [ids, options, pull, dump] = uploadResult;

  const id = ids.at(0);

  const body = UpdateMetadata(options);
  if (body instanceof ArkErrors)
    throw createError({ statusCode: 400, message: body.summary });

  const updateModel: Prisma.GameUpdateInput = {
    ...(body.name ? { mName: body.name } : undefined),
    ...(body.description ? { mShortDescription: body.description } : undefined),
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
