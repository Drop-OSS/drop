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
      versionId: version,
    },
    include: {
      launches: {
        include: {
          executor: {
            include: {
              gameVersion: {
                select: {
                  game: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
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

  const gameVersionMapped = {
    ...gameVersion,
    launches: gameVersion.launches.map((launch) => ({
      ...launch,
      executor: launch.executor
        ? {
            ...launch.executor,
            gameVersion: undefined,
            gameId: launch.executor.gameVersion.game.id,
          }
        : undefined,
    })),
  };

  return {
    ...gameVersionMapped,
    size: libraryManager.getGameVersionSize(id, version),
  };
});
