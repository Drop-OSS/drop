import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();
  const library = await userLibraryManager.fetchLibrary(user.id);
  return library.entries.map((e) => e.game);
});
