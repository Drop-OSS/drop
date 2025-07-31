import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineClientEventHandler(async (_h3, { fetchUser }) => {
  const user = await fetchUser();
  const library = await userLibraryManager.fetchLibrary(user.id);
  return library.entries.map((e) => e.game);
});
