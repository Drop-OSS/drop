import { ArkErrors, type } from "arktype";
import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

const Query = type({
  id: "string",
  version: "string",
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type APIQuery = typeof Query.inferIn;

/**
 * Fetch recommendations for version import.
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = Query(await getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid query: " + query.summary,
    });
  const gameId = query.id;
  const versionName = query.version;

  const preload = await libraryManager.fetchUnimportedVersionInformation(
    gameId,
    versionName,
  );
  if (!preload)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid game or version id/name",
    });

  return preload;
});
