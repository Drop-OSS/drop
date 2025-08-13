import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

const EntryDelete = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Remove game from user's library
 */
export default defineClientEventHandler(async (h3, { fetchUser, body }) => {
  const user = await fetchUser();

  const gameId = body.id;

  await userLibraryManager.libraryRemove(gameId, user.id);
  return {};
}, EntryDelete);
