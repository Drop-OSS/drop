import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["library:add"]);
  if (!userId)
    throw createError({
      statusCode: 403,
      message: "Requires authentication",
    });

  const body = await readBody(h3);
  const gameId = body.id;
  if (!gameId)
    throw createError({ statusCode: 400, message: "Game ID required" });

  // Add the game to the default collection
  await userLibraryManager.libraryAdd(gameId, userId);
  return {};
});
