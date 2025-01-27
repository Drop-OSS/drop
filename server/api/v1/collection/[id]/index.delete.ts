import userLibraryManager from "~/server/internal/userlibrary";

export default defineEventHandler(async (h3) => {
  const userId = await h3.context.session.getUserId(h3);
  if (!userId)
    throw createError({
      statusCode: 403,
      statusMessage: "Requires authentication",
    });

  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "ID required in route params",
    });

  // Verify collection exists and user owns it
  const collection = await userLibraryManager.fetchCollection(id);
  if (!collection) {
    throw createError({
      statusCode: 404,
      statusMessage: "Collection not found",
    });
  }

  if (collection.userId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Not authorized to delete this collection",
    });
  }

  // Don't allow deleting default collection
  if (collection.isDefault) {
    throw createError({
      statusCode: 400,
      statusMessage: "Cannot delete default collection",
    });
  }

  await userLibraryManager.deleteCollection(id);
  return { success: true };
});
