import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

const AddGame = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Add game to user library
 */
export default defineEventHandler<{ body: typeof AddGame.infer }>(
  async (h3) => {
    const userId = await aclManager.getUserIdACL(h3, ["library:add"]);
    if (!userId)
      throw createError({
        statusCode: 403,
        statusMessage: "Requires authentication",
      });

    const body = await readDropValidatedBody(h3, AddGame);
    const gameId = body.id;

    // Add the game to the default collection
    await userLibraryManager.libraryAdd(gameId, userId);
    return {};
  },
);
