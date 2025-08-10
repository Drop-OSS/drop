import { ArkErrors, type } from "arktype";
import cacheHandler from "~/server/internal/cache";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

const chunkSize = 1024 * 1024 * 64;

const gameLookupCache = cacheHandler.createCache<{
  libraryId: string | null;
  libraryPath: string;
}>("downloadGameLookupCache");

const Query = type({
  id: "string",
  version: "string",
  name: "string",
  chunk: "string.numeric.parse",
});

/**
 * v1 download API
 * @deprecated
 * @response Raw binary data (`application/octet-stream`)
 */
export default defineClientEventHandler<unknown, { query: typeof Query.infer }>(
  async (h3) => {
    const query = Query(getQuery(h3));
    if (query instanceof ArkErrors)
      throw createError({ statusCode: 400, statusMessage: query.summary });
    const gameId = query.id;
    const versionName = query.version;
    const filename = query.name;
    const chunkIndex = query.chunk;

    if (!gameId || !versionName || !filename || Number.isNaN(chunkIndex))
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid chunk arguments",
      });

    let game = await gameLookupCache.getItem(gameId);
    if (!game) {
      game = await prisma.game.findUnique({
        where: {
          id: gameId,
        },
        select: {
          libraryId: true,
          libraryPath: true,
        },
      });
      if (!game || !game.libraryId)
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid game ID",
        });

      await gameLookupCache.setItem(gameId, game);
    }

    if (!game.libraryId)
      throw createError({
        statusCode: 500,
        statusMessage: "Somehow, we got here.",
      });

    const peek = await libraryManager.peekFile(
      game.libraryId,
      game.libraryPath,
      versionName,
      filename,
    );
    if (!peek)
      throw createError({ status: 400, statusMessage: "Failed to peek file" });

    const start = chunkIndex * chunkSize;
    const end = Math.min((chunkIndex + 1) * chunkSize, peek.size);
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
      { start, end },
    );
    if (!gameReadStream)
      throw createError({
        statusCode: 400,
        statusMessage: "Failed to create stream",
      });

    return sendStream(h3, gameReadStream);
  },
);
