import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = await getQuery(h3);
  const gameId = query.id?.toString();
  if (!gameId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id in request params",
    });

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
