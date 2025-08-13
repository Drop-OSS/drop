import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

const AddEntry = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Add game to user's library
 */
export default defineClientEventHandler(async (h3, { fetchUser, body }) => {
  const user = await fetchUser();

  const gameId = body.id;

  // Add the game to the default collection
  await userLibraryManager.libraryAdd(gameId, user.id);
  return {};
}, AddEntry);
