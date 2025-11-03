import { ArkErrors, type } from "arktype";
import aclManager from "~~/server/internal/acls";
import prisma from "~~/server/internal/db/database";
import libraryManager, { VersionImportModes } from "~~/server/internal/library";

export const PreloadQuery = type({
  id: "string",
  mode: type.enumerated(...VersionImportModes),
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const rawQuery = await getQuery(h3);
  const query = PreloadQuery(rawQuery);
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, message: query.summary });

  const value: { libraryId: string; libraryPath: string } | undefined =
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma[query.mode] as any).findUnique({
      where: { id: query.id },
      select: { libraryId: true, libraryPath: true },
    });
  if (!value) throw createError({ statusCode: 404, message: "Not found" });

  const unimportedVersions = await libraryManager.fetchUnimportedGameVersions(
    value.libraryId,
    value.libraryPath,
  );
  if (!unimportedVersions)
    throw createError({ statusCode: 400, message: "Invalid game ID" });

  return unimportedVersions;
});
