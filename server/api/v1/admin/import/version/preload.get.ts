import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = await getQuery(h3);
  const gameId = query.id?.toString();
  const versionName = query.version?.toString();
  if (!gameId || !versionName)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id or version in request params",
    });

  try {
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
  } catch (e) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch preload information for ${gameId}: ${e}`,
    });
  }
});
