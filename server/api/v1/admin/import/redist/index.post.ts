import { ArkErrors, type } from "arktype";
import aclManager from "~/server/internal/acls";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";
import * as jdenticon from "jdenticon";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

export const ImportRedist = type({
  library: "string",
  path: "string",

  name: "string",
  description: "string",
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:redist:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await handleFileUpload(h3, {}, ["internal:read"], 1);
  if (!body)
    throw createError({ statusCode: 400, statusMessage: "Body required." });

  const [[id], rawOptions, pull,, add] = body;

  const options = ImportRedist(rawOptions);
  if (options instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: options.summary });

  const valid = await libraryManager.checkUnimportedGamePath(
    options.library,
    options.path,
  );
  if (!valid)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid library or game.",
    });

  const icon = id ?? add(jdenticon.toPng(options.name, 512));

  const redist = await prisma.redist.create({
    data: {
      libraryId: options.library,
      libraryPath: options.path,

      mName: options.name,
      mShortDescription: options.description,
      mIconObjectId: icon,
    },
  });

  await pull();

  return redist;
});
