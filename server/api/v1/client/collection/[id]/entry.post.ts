import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

const AddEntry = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Add entry to collection by game ID
 * @param id Collection ID
 */
export default defineClientEventHandler(async (h3, { fetchUser, body }) => {
  const user = await fetchUser();

  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "ID required in route params",
    });

  const gameId = body.id;

  return await userLibraryManager.collectionAdd(gameId, id, user.id);
}, AddEntry);
