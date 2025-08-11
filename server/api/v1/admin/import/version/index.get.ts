import { ArkErrors, type } from "arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

const Query = type({
  id: "string",
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type APIQuery = typeof Query.inferIn;

/**
 *  Fetch all versions available for import for a game (`id` in query params).
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = Query(await getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid query params: " + query.summary,
    });

  const gameId = query.id;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { libraryId: true, libraryPath: true },
  });
  if (!game || !game.libraryId)
    throw createError({ statusCode: 404, statusMessage: "Game not found" });

  const unimportedVersions = await libraryManager.fetchUnimportedGameVersions(
    game.libraryId,
    game.libraryPath,
  );
  if (!unimportedVersions)
    throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

  return unimportedVersions;
});
