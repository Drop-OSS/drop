import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

/**
 * Fetch collection by ID
 * @param id Collection ID
 */
export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

  const id = getRouterParam(h3, "id")!;

  // Fetch specific collection
  // Will not return the default collection
  const collection = await userLibraryManager.fetchCollection(id);
  if (!collection)
    throw createError({
      statusCode: 404,
      statusMessage: "Collection not found",
    });

  // Verify user owns this collection
  if (collection.userId !== user.id)
    throw createError({
      statusCode: 403,
      statusMessage: "Not authorized to access this collection",
    });

  return collection;
});
