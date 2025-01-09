import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(async (h3) => {
  const query = getQuery(h3);
  const id = query.id?.toString();
  const version = query.version?.toString();
  if (!id || !version)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id or version in query",
    });

  const gameVersion = await prisma.gameVersion.findUnique({
    where: {
      gameId_versionName: {
        gameId: id,
        versionName: version,
      },
    },
  });

  if (!gameVersion)
    throw createError({
      statusCode: 404,
      statusMessage: "Game version not found",
    });

  return gameVersion;
});
