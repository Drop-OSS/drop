import aclManager from "~/server/internal/acls";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

  const body = await readBody(h3);
  const gameId = body.id;
  if (!gameId)
    throw createError({ statusCode: 400, statusMessage: "Game ID required" });

  // Add the game to the default collection
  await userLibraryManager.libraryAdd(gameId, user.id);
  return {};
});
