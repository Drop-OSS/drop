import type { Platform } from "~/prisma/client/enums";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import type { GameVersionSize } from "~/server/internal/gamesize";
import gameSizeManager from "~/server/internal/gamesize";

type VersionDownloadOption = {
  gameId: string;
  versionId: string;
  displayName?: string | undefined;
  versionPath?: string | undefined;
  platform: Platform;
  size: GameVersionSize;
  requiredContent: Array<{
    gameId: string;
    versionId: string;
    name: string;
    iconObjectId: string;
    shortDescription: string;
    size: GameVersionSize;
  }>;
};

export default defineClientEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id")!;
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "No ID in router params",
    });

  const rawVersions = await prisma.gameVersion.findMany({
    where: {
      gameId: id,
    },
    orderBy: {
      versionIndex: "desc", // Latest one first
    },
    select: {
      versionId: true,
      displayName: true,
      versionPath: true,
      gameId: true,
      launches: {
        select: {
          platform: true,
          emulator: {
            select: {
              gameVersion: {
                select: {
                  game: {
                    select: {
                      mName: true,
                      mShortDescription: true,
                      mIconObjectId: true,
                      id: true,
                    },
                  },
                  versionId: true,
                },
              },
            },
          },
        },
      },
      setups: true,
    },
  });

  const versions: Array<VersionDownloadOption> = (
    await Promise.all(
      rawVersions.map(async (v) => {
        const platformOptions: Map<
          Platform,
          VersionDownloadOption["requiredContent"]
        > = new Map();

        for (const launch of [...v.launches, ...v.setups]) {
          if (!platformOptions.has(launch.platform))
            platformOptions.set(launch.platform, []);

          if ("emulator" in launch && launch.emulator) {
            const old = platformOptions.get(launch.platform)!;
            const gv = launch.emulator.gameVersion;
            old.push({
              gameId: gv.game.id,
              versionId: gv.versionId,
              name: gv.game.mName,
              iconObjectId: gv.game.mIconObjectId,
              shortDescription: gv.game.mShortDescription,
              size: (await gameSizeManager.getVersionSize(gv.versionId))!,
            });
          }
        }

        const size = await gameSizeManager.getVersionSize(v.versionId);

        return platformOptions
          .entries()
          .map(
            ([platform, requiredContent]) =>
              ({
                gameId: v.gameId,
                versionId: v.versionId,
                displayName: v.displayName || undefined,
                versionPath: v.versionPath || undefined,
                platform,
                requiredContent,
                size: size!,
              }) satisfies VersionDownloadOption,
          )
          .toArray();
      }),
    )
  ).flat();

  return versions;
});
