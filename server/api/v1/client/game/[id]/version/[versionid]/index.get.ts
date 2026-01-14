import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

export default defineClientEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id");
  const version = getRouterParam(h3, "versionid");
  if (!id || !version)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id or version in route params",
    });

  const gameVersion = await prisma.gameVersion.findUnique({
    where: {
      gameId_versionId: {
        gameId: id,
        versionId: version,
      },
    },
    include: {
      launches: {
        include: {
          executor: true,
        },
      },
      setups: true,
    },
  });

  if (!gameVersion)
    throw createError({
      statusCode: 404,
      statusMessage: "Game version not found",
    });

  return {
    ...gameVersion,
    size: libraryManager.getGameVersionSize(id, version),
  };
});
