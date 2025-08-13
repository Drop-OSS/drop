import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

/**
 * Delete collection by ID
 * @param id Collection ID
 */
export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

  const id = getRouterParam(h3, "id")!;

  // Verify collection exists and user owns it
  // Will not return the default collection
  const collection = await userLibraryManager.fetchCollection(id);
  if (!collection)
    throw createError({
      statusCode: 404,
      statusMessage: "Collection not found",
    });

  if (collection.userId !== user.id)
    throw createError({
      statusCode: 403,
      statusMessage: "Not authorized to delete this collection",
    });

  await userLibraryManager.deleteCollection(id);
  return;
});
