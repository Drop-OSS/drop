import { ArkErrors, type } from "arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

const Query = type({
  id: "string",
  version: "string",
});

/**
 * Fetch version metadata from game ID and version name
 * @request `id` and `version` query params are required.
 */
export default defineClientEventHandler(async (h3) => {
  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: query.summary });
  const id = query.id;
  const version = query.version;

  const gameVersion = await prisma.gameVersion.findUnique({
    where: {
      gameId_versionName: {
        gameId: id,
        versionName: version,
      },
    },
    omit: {
      dropletManifest: true,
    },
  });

  if (!gameVersion)
    throw createError({
      statusCode: 404,
      statusMessage: "Game version not found",
    });

  return gameVersion;
});
