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

  // Fetch specific collection
  const collection = await userLibraryManager.fetchCollection(id);
  if (!collection) {
    throw createError({
      statusCode: 404,
      statusMessage: "Collection not found",
    });
  }

  // Verify user owns this collection
  if (collection.userId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Not authorized to access this collection",
    });
  }

  return collection;
});
