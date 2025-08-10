import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

const AddEntry = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Add game to collection
 * @param id Collection ID
 */
export default defineEventHandler<{ body: typeof AddEntry.infer }>(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["collections:add"]);
  if (!userId)
    throw createError({
      statusCode: 403,
    });

  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "ID required in route params",
    });

  const body = await readDropValidatedBody(h3, AddEntry);
  const gameId = body.id;

  return await userLibraryManager.collectionAdd(gameId, id, userId);
});
