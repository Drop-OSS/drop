import type { GameVersion, Prisma } from "~/prisma/client/client";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import gameSizeManager from "~/server/internal/gamesize";
import type { UnimportedVersionInformation } from "~/server/internal/library";
import libraryManager from "~/server/internal/library";

async function getGameVersionSize<
  T extends Omit<GameVersion, "dropletManifest">,
>(gameId: string, version: T) {
  const clientSize = await gameSizeManager.getVersionSize(version.versionId);
  const diskSize = await gameSizeManager.getVersionDiskSize(version.versionId);
  return { ...version, diskSize, clientSize };
}

export type AdminFetchGameType = Prisma.GameGetPayload<{
  include: {
    versions: {
      include: {
        setups: true;
        launches: {
          include: {
            executor: {
              include: {
                gameVersion: {
                  select: {
                    versionId: true;
                    displayName: true;
                    versionPath: true;
                    game: {
                      select: {
                        id: true;
                        mName: true;
                        mIconObjectId: true;
                      };
                    };
                  };
                };
              };
            };
            executions: {
              select: {
                launchId: true;
              };
            };
          };
        };
      };
      omit: {
        dropletManifest: true;
      };
    };
    tags: true;
  };
}>;

// Types in the route ensure we actually return the value as defined above
export default defineEventHandler<
  { body: never },
  Promise<{
    game: AdminFetchGameType;
    unimportedVersions: UnimportedVersionInformation[] | undefined;
  }>
>(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const gameId = getRouterParam(h3, "id")!;

  const game = await prisma.game.findUnique({
    where: {
      id: gameId,
    },
    include: {
      versions: {
        include: {
          setups: true,
          launches: {
            include: {
              executor: {
                include: {
                  gameVersion: {
                    select: {
                      versionId: true,
                      displayName: true,
                      versionPath: true,
                      game: {
                        select: {
                          id: true,
                          mName: true,
                          mIconObjectId: true,
                        },
                      },
                    },
                  },
                },
              },
              executions: {
                select: {
                  launchId: true,
                },
              },
            },
          },
        },
        omit: {
          dropletManifest: true,
        },
        orderBy: {
          versionIndex: "asc",
        },
      },
      tags: true,
    },
  });

  if (!game || !game.libraryId)
    throw createError({ statusCode: 404, statusMessage: "Game ID not found" });

  const gameWithVersionSize = {
    ...game,
    versions: await Promise.all(
      game.versions.map((v) => getGameVersionSize(gameId, v)),
    ),
  };

  const unimportedVersions = await libraryManager.fetchUnimportedGameVersions(
    game.libraryId,
    game.libraryPath,
  );

  return { game: gameWithVersionSize, unimportedVersions };
});
