import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["collections:delete"]);
  if (!userId)
    throw createError({
      statusCode: 403,
      message: "Requires authentication",
    });

  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      message: "ID required in route params",
    });

  // Verify collection exists and user owns it
  // Will not return the default collection
  const collection = await userLibraryManager.fetchCollection(id);
  if (!collection)
    throw createError({
      statusCode: 404,
      message: "Collection not found",
    });

  if (collection.userId !== userId)
    throw createError({
      statusCode: 403,
      message: "Not authorized to delete this collection",
    });

  await userLibraryManager.deleteCollection(id);
  return { success: true };
});
