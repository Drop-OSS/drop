import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

const DeleteEntry = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Remove game from user library
 */
export default defineEventHandler<{ body: typeof DeleteEntry.infer }>(
  async (h3) => {
    const userId = await aclManager.getUserIdACL(h3, ["library:remove"]);
    if (!userId)
      throw createError({
        statusCode: 403,
        statusMessage: "Requires authentication",
      });

    const body = await readDropValidatedBody(h3, DeleteEntry);

    const gameId = body.id;

    await userLibraryManager.libraryRemove(gameId, userId);
    return {};
  },
);
