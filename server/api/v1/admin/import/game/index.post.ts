import libraryManager from "~/server/internal/library";
import {
  GameMetadataSearchResult,
  GameMetadataSource,
} from "~/server/internal/metadata/types";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

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
    return await h3.context.metadataHandler.createGameWithoutMetadata(path);
  } else {
    return await h3.context.metadataHandler.createGame(metadata, path);
  }
});
