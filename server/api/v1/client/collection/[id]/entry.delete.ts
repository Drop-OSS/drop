import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

const EntryRemove = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Remove entry from user's collection
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

  const successful = await userLibraryManager.collectionRemove(
    gameId,
    id,
    user.id,
  );
  if (!successful)
    throw createError({
      statusCode: 404,
      statusMessage: "Collection not found",
    });
  return {};
}, EntryRemove);
