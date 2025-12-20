import type { GameVersion } from "~/prisma/client/client";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

async function getGameVersionSize<T extends Omit<GameVersion, "dropletManifest">>(gameId: string, version: T) {
  const size = await libraryManager.getGameVersionSize(
    gameId,
    version.versionId,
  );
  return { ...version, size };
}

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const gameId = getRouterParam(h3, "id")!;

  const game = await prisma.game.findUnique({
    where: {
      id: gameId,
    },
    include: {
      versions: {
        orderBy: {
          versionIndex: "asc",
        },
        omit: {
          dropletManifest: true,
        },
        include: {
          launches: true,
          setups: true,
        },
      },
      tags: true,
    },
  });

  if (!game || !game.libraryId)
    throw createError({ statusCode: 404, statusMessage: "Game ID not found" });

  const gameWithVersionSize = {
    ...game,
    versions: await Promise.all(game.versions.map((v) => getGameVersionSize(gameId, v))),
  };

  const unimportedVersions = await libraryManager.fetchUnimportedGameVersions(
    game.libraryId,
    game.libraryPath,
  );

  return { game: gameWithVersionSize, unimportedVersions };
});
