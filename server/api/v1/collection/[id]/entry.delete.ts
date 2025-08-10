import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

const RemoveEntry = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Remove entry from collection
 * @param id Collection ID
 */
export default defineEventHandler<{ body: typeof RemoveEntry.infer }>(
  async (h3) => {
    const userId = await aclManager.getUserIdACL(h3, ["collections:remove"]);
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

    const body = await readDropValidatedBody(h3, RemoveEntry);
    const gameId = body.id;

    const successful = await userLibraryManager.collectionRemove(
      gameId,
      id,
      userId,
    );
    if (!successful)
      throw createError({
        statusCode: 404,
        statusMessage: "Collection not found",
      });
    return {};
  },
);
