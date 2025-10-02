import { ArkErrors, type } from "arktype";
import aclManager from "~~/server/internal/acls";
import libraryManager, { VersionImportModes } from "~~/server/internal/library";

export const PreloadQuery = type({
  id: "string",
  version: "string",
  mode: type.enumerated(...VersionImportModes),
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const rawQuery = await getQuery(h3);
  const query = PreloadQuery(rawQuery);
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, message: query.summary });

  const preload = await libraryManager.fetchUnimportedVersionInformation(
    query.id,
    query.mode,
    query.version,
  );
  if (!preload)
    throw createError({
      statusCode: 400,
      message: "Invalid game or version id/name",
    });

  return preload;
});
