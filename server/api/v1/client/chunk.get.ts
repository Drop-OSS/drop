import prisma from "~/server/internal/db/database";
import fs from "fs";
import path from "path";
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
      libraryBasePath: true,
    },
  });
  if (!game)
    throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

  const versionDir = path.join(
    libraryManager.fetchLibraryPath(),
    game.libraryBasePath,
    versionName,
  );
  if (!fs.existsSync(versionDir))
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid version name",
    });

  const gameFile = path.join(versionDir, filename);
  if (!fs.existsSync(gameFile))
    throw createError({ statusCode: 400, statusMessage: "Invalid game file" });

  const gameFileStats = fs.statSync(gameFile);

  const start = chunkIndex * chunkSize;
  const end = Math.min((chunkIndex + 1) * chunkSize, gameFileStats.size);
  const currentChunkSize = end - start;
  setHeader(h3, "Content-Length", currentChunkSize);

  if (start >= end)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid chunk index",
    });

  const gameReadStream = fs.createReadStream(gameFile, { start, end: end - 1 }); // end needs to be offset by 1

  return sendStream(h3, gameReadStream);
});
