import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

/**
 * Fetch user's library
 */
export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

  const collection = await userLibraryManager.fetchLibrary(user.id);

  return collection;
});
