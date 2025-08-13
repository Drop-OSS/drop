import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

/**
 * Fetch all of user's collections
 */
export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

  const collections = await userLibraryManager.fetchCollections(user.id);
  return collections;
});
