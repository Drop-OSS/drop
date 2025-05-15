// get all user screenshots by game
import aclManager from "~/server/internal/acls";
import screenshotManager from "~/server/internal/screenshots";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["screenshots:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const gameId = getRouterParam(h3, "id");
  if (!gameId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing game ID",
    });

  const results = await screenshotManager.getUserAllByGame(userId, gameId);
  return results;
});
