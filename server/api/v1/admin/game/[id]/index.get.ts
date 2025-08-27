import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

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
        where: {
          gameVersion: {
            isNot: null,
          },
        },
        orderBy: {
          gameVersion: {
            versionIndex: "asc",
          },
        },
        omit: {
          dropletManifest: true,
        },
      },
      tags: true,
    },
  });

  if (!game || !game.libraryId)
    throw createError({ statusCode: 404, message: "Game ID not found" });

  const unimportedVersions = await libraryManager.fetchUnimportedGameVersions(
    game.libraryId,
    game.libraryPath,
  );

  return { game, unimportedVersions };
});
