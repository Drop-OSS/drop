import type { Platform } from "~/prisma/client/enums";
import prisma from "~/server/internal/db/database";
import gameSizeManager from "~/server/internal/gamesize";

type VersionDownloadOption = {
  versionId: string;
  displayName?: string | undefined;
  versionPath?: string | undefined;
  platform: Platform;
  size: number;
  requiredContent: Array<{
    gameId: string;
    versionId: string;
    name: string;
    iconObjectId: string;
    shortDescription: string;
    size: number;
  }>;
};

export default defineEventHandler(async (h3) => {
  const query = getQuery(h3);
  const id = query.id?.toString();
  console.log("[DEBUG] /api/v1/client/game/versions (query) called with ID:", id);
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "No ID in request query",
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
    },
  });

  const versions: Array<VersionDownloadOption> = (
    await Promise.all(
      rawVersions.map(async (v) => {
        const platformOptions: Map<
          Platform,
          VersionDownloadOption["requiredContent"]
        > = new Map();

        for (const launch of v.launches) {
          if (!platformOptions.has(launch.platform))
            platformOptions.set(launch.platform, []);

          if (launch.executor) {
            const old = platformOptions.get(launch.platform)!;
            old.push({
              gameId: launch.executor.gameVersion.game.id,
              versionId: launch.executor.gameVersion.versionId,
              name: launch.executor.gameVersion.game.mName,
              iconObjectId: launch.executor.gameVersion.game.mIconObjectId,
              shortDescription:
                launch.executor.gameVersion.game.mShortDescription,
              size:
                (await gameSizeManager.getVersionSize(
                  launch.executor.gameVersion.versionId,
                )) ?? { downloadSize: 0, installSize: 0, versionId: launch.executor.gameVersion.versionId },
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
