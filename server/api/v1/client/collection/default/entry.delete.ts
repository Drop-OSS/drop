import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

  const body = await readBody(h3);

  const gameId = body.id;
  if (!gameId)
    throw createError({ statusCode: 400, message: "Game ID required" });

  await userLibraryManager.libraryRemove(gameId, user.id);
  return {};
});
