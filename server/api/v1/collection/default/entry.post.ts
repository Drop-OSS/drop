import userLibraryManager from "~/server/internal/userlibrary";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
  if (!userId)
    throw createError({
      statusCode: 403,
      statusMessage: "Requires authentication",
    });

  const body = await readBody(h3);
  const gameId = body.id;
  if (!gameId)
    throw createError({ statusCode: 400, statusMessage: "Game ID required" });

  // Get the default collection for this user
  const collections = await userLibraryManager.fetchCollections(userId);
  const defaultCollection = collections.find(c => c.isDefault);
  
  if (!defaultCollection) {
    throw createError({
      statusCode: 404,
      statusMessage: "Default collection not found",
    });
  }

  // Add the game to the default collection
  await userLibraryManager.collectionAdd(gameId, defaultCollection.id);
  return {};
});
