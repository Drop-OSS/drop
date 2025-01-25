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

  await userLibraryManager.libraryRemove(gameId, userId);
  return {};
});
