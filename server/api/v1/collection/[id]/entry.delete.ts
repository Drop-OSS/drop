import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["collections:remove"]);
  if (!userId)
    throw createError({
      statusCode: 403,
    });

  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      message: "ID required in route params",
    });

  const body = await readBody(h3);
  const gameId = body.id;
  if (!gameId)
    throw createError({ statusCode: 400, message: "Game ID required" });

  const successful = await userLibraryManager.collectionRemove(
    gameId,
    id,
    userId,
  );
  if (!successful)
    throw createError({
      statusCode: 404,
      message: "Collection not found",
    });
  return {};
});
