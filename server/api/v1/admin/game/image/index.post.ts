import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:image:new"]);
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
  if (!id) {
    dump();
    throw createError({
      statusCode: 400,
      statusMessage: "Did not upload a file",
    });
  }

  const gameId = options.id;
  if (!gameId)
    throw createError({
      statusCode: 400,
      statusMessage: "No game ID attached",
    });

  const hasGame = (await prisma.game.count({ where: { id: gameId } })) != 0;
  if (!hasGame) {
    dump();
    throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });
  }

  const result = await prisma.game.update({
    where: {
      id: gameId,
    },
    data: {
      mImageLibraryObjectIds: {
        push: id,
      },
    },
  });

  await pull();
  return result;
});
