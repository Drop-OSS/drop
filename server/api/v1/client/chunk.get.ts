import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import fs from "fs";
import path from "path";
import libraryManager from "~/server/internal/library";

const chunkSize = 1024 * 1024 * 64;

export default defineClientEventHandler(async (h3) => {
  const query = getQuery(h3);
  const gameId = query.id?.toString();
  const versionName = query.versionName?.toString();
  const filename = query.name?.toString();
  const chunkIndex = parseInt(query.chunk?.toString() ?? "?");

  if (!gameId || !versionName || !filename || !Number.isNaN(chunkIndex))
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

  const versionDir = path.join(libraryManager.fetchLibraryPath(), versionName);
  if (!fs.existsSync(versionDir))
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid version name",
    });

  const gameFile = path.join(versionDir, filename);
  if (!fs.existsSync(versionDir))
    throw createError({ statusCode: 400, statusMessage: "Invalid game file" });

  const gameFileStats = fs.statSync(gameFile);

  const start = chunkIndex * chunkSize;
  const end = Math.min((chunkIndex + 1) * chunkSize, gameFileStats.size);
  const gameReadStream = fs.createReadStream(gameFile, { start, end });

  return sendStream(h3, gameReadStream);
});
