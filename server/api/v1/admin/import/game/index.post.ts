import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";
import metadataHandler from "~/server/internal/metadata";
import type {
  GameMetadataSearchResult,
  GameMetadataSource,
} from "~/server/internal/metadata/types";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:game:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);

  const path = body.path;
  const metadata = body.metadata as GameMetadataSearchResult &
    GameMetadataSource;
  if (!path)
    throw createError({
      statusCode: 400,
      statusMessage: "Path missing from body",
    });

  const validPath = await libraryManager.checkUnimportedGamePath(path);
  if (!validPath)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid unimported game path",
    });

  if (!metadata || !metadata.id || !metadata.sourceId) {
    console.log(metadata);
    return await metadataHandler.createGameWithoutMetadata(path);
  } else {
    return await metadataHandler.createGame(metadata, path);
  }
});
