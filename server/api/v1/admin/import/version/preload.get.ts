import { ArkErrors, type } from "arktype";
import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

const Query = type({
  id: "string",
  type: "'depot' | 'local'",
  version: "string",
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({
      statusCode: 400,
      message: query.summary,
    });

  try {
    const preload = await libraryManager.fetchUnimportedVersionInformation(
      query.id,
      {
        type: query.type,
        identifier: query.version,
      },
    );
    if (!preload)
      throw createError({
        statusCode: 400,
        message: "Invalid game or version id/name",
      });

    return preload;
  } catch (e) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch preload information for ${query.id}: ${e}`,
    });
  }
});
