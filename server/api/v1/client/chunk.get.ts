import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

const chunkSize = 1024 * 1024 * 64;

export default defineEventHandler(async (h3) => {
  const query = getQuery(h3);
  const gameId = query.id?.toString();
  const versionName = query.version?.toString();
  const filename = query.name?.toString();
  const chunkIndex = parseInt(query.chunk?.toString() ?? "?");

  if (!gameId || !versionName || !filename || Number.isNaN(chunkIndex))
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid chunk arguments",
    });

  const game = await prisma.game.findUnique({
    where: {
      id: gameId,
    },
    select: {
      libraryId: true,
      libraryPath: true,
    },
  });
  if (!game || !game.libraryId)
    throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

  const start = chunkIndex * chunkSize;
  const end = chunkIndex + 1;
  const currentChunkSize = end - start;
  setHeader(h3, "Content-Length", currentChunkSize);

  if (start >= end)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid chunk index",
    });

  const gameReadStream = await libraryManager.readFile(
    game.libraryId,
    game.libraryPath,
    versionName,
    filename,
    { start, end: end - 1 },
  ); // end needs to be offset by 1
  if (!gameReadStream)
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to create stream",
    });

  return sendStream(h3, gameReadStream);
});
