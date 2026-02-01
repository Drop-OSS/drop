import type { Platform } from "~/prisma/client/enums";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import type { GameVersionSize } from "~/server/internal/gamesize";
import gameSizeManager from "~/server/internal/gamesize";

type VersionDownloadOption = {
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
          executor: {
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

          if ("executor" in launch && launch.executor) {
            const old = platformOptions.get(launch.platform)!;
            old.push({
              gameId: launch.executor.gameVersion.game.id,
              versionId: launch.executor.gameVersion.versionId,
              name: launch.executor.gameVersion.game.mName,
              iconObjectId: launch.executor.gameVersion.game.mIconObjectId,
              shortDescription:
                launch.executor.gameVersion.game.mShortDescription,
              size: (await gameSizeManager.getVersionSize(
                launch.executor.gameVersion.versionId,
              ))!,
            });
          }
        }

        const size = await gameSizeManager.getVersionSize(v.versionId);

        return platformOptions
          .entries()
          .map(
            ([platform, requiredContent]) =>
              ({
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
