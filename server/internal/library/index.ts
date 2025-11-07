/**
 * The Library Manager keeps track of games in Drop's library and their various states.
 * It uses path relative to the library, so it can moved without issue
 *
 * It also provides the endpoints with information about unmatched games
 */

import path from "path";
import prisma from "../db/database";
import { fuzzy } from "fast-fuzzy";
import taskHandler from "../tasks";
import notificationSystem from "../notifications";
import { GameNotFoundError, type LibraryProvider } from "./provider";
import { logger } from "../logging";
import { createHash } from "node:crypto";
import type { ImportVersion } from "~~/server/api/v1/admin/import/version/index.post";
import type {
  GameVersionCreateInput,
  LaunchOptionCreateManyInput,
  VersionCreateInput,
  VersionWhereInput,
} from "~~/prisma/client/models";
import type { PlatformLink } from "~~/prisma/client/client";
import { convertIDToLink } from "../platform/link";
import type { WorkingLibrarySource } from "~~/server/api/v1/admin/library/sources/index.get";
import gameSizeManager from "../gamesize";

export const VersionImportModes = ["game", "redist"] as const;
export type VersionImportMode = (typeof VersionImportModes)[number];

const modeToLink: { [key in VersionImportMode]: string } = {
  game: "g",
  redist: "r",
};

export function createGameImportTaskId(libraryId: string, libraryPath: string) {
  return createHash("md5")
    .update(`import:${libraryId}:${libraryPath}`)
    .digest("hex");
}

export function createVersionImportTaskId(gameId: string, versionName: string) {
  return createHash("md5")
    .update(`import:${gameId}:${versionName}`)
    .digest("hex");
}

class LibraryManager {
  private libraries: Map<string, LibraryProvider<unknown>> = new Map();

  addLibrary(library: LibraryProvider<unknown>) {
    this.libraries.set(library.id(), library);
  }

  removeLibrary(id: string) {
    this.libraries.delete(id);
  }

  async fetchLibraries(): Promise<WorkingLibrarySource[]> {
    const libraries = await prisma.library.findMany({});

    const libraryWithMetadata = libraries.map(async (library) => {
      const theLibrary = this.libraries.get(library.id);
      const working = this.libraries.has(library.id);
      return {
        ...library,
        working,
        fsStats: working ? theLibrary?.fsStats() : undefined,
      };
    });
    return await Promise.all(libraryWithMetadata);
  }

  async fetchGamesByLibrary() {
    const results: { [key: string]: { [key: string]: boolean } } = {};
    const games = await prisma.game.findMany({});
    const redist = await prisma.redist.findMany({});
    for (const item of [...games, ...redist]) {
      const libraryId = item.libraryId!;
      const libraryPath = item.libraryPath!;

      results[libraryId] ??= {};
      results[libraryId][libraryPath] = true;
    }

    return results;
  }

  async fetchUnimportedGames() {
    const unimportedGames: { [key: string]: string[] } = {};
    const instanceGames = await this.fetchGamesByLibrary();

    for (const [id, library] of this.libraries.entries()) {
      const providerGames = await library.listGames();
      const providerUnimportedGames = providerGames.filter(
        (libraryPath) =>
          !instanceGames[id]?.[libraryPath] &&
          !taskHandler.hasTask(createGameImportTaskId(id, libraryPath)),
      );
      unimportedGames[id] = providerUnimportedGames;
    }

    return unimportedGames;
  }

  async fetchUnimportedGameVersions(libraryId: string, libraryPath: string) {
    const provider = this.libraries.get(libraryId);
    if (!provider) return undefined;
    const game =
      (await prisma.game.findUnique({
        where: {
          libraryKey: {
            libraryId,
            libraryPath,
          },
        },
        select: {
          id: true,
          versions: true,
        },
      })) ??
      (await prisma.redist.findUnique({
        where: {
          libraryKey: {
            libraryId,
            libraryPath,
          },
        },
        select: {
          id: true,
          versions: true,
        },
      }));
    if (!game) return undefined;

    try {
      const versions = await provider.listVersions(libraryPath);
      const unimportedVersions = versions.filter(
        (e) =>
          game.versions.findIndex((v) => v.versionName == e) == -1 &&
          !taskHandler.hasTask(createVersionImportTaskId(game.id, e)),
      );
      return unimportedVersions;
    } catch (e) {
      if (e instanceof GameNotFoundError) {
        logger.warn(e);
        return undefined;
      }
      throw e;
    }
  }

  async fetchLibraryObjectWithStatus<T>(
    objects: Array<
      {
        libraryId: string;
        libraryPath: string;
        versions: Array<unknown>;
      } & T
    >,
  ) {
    return await Promise.all(
      objects.map(async (e) => {
        const versions = await this.fetchUnimportedGameVersions(
          e.libraryId ?? "",
          e.libraryPath,
        );
        return {
          value: e,
          status: versions
            ? {
                noVersions: e.versions.length == 0,
                unimportedVersions: versions,
              }
            : ("offline" as const),
        };
      }),
    );
  }

  async fetchGamesWithStatus() {
    const games = await prisma.game.findMany({
      include: {
        versions: {
          select: {
            versionId: true,
            versionName: true,
          },
        },
        library: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        mName: "asc",
      },
    });

    return await this.fetchLibraryObjectWithStatus(games);
  }

  async fetchRedistsWithStatus() {
    const redists = await prisma.redist.findMany({
      include: {
        versions: {
          select: {
            versionId: true,
            versionName: true,
          },
        },
        library: {
          select: {
            id: true,
            name: true,
          },
        },
        platform: true,
      },
      orderBy: {
        mName: "asc",
      },
    });

    return await this.fetchLibraryObjectWithStatus(redists);
  }

  private async fetchLibraryPath(
    id: string,
    mode: VersionImportMode,
    platform?: PlatformLink,
  ): Promise<
    | [
        { mName: string; libraryId: string; libraryPath: string } | null,
        VersionWhereInput,
      ]
    | undefined
  > {
    switch (mode) {
      case "game":
        return [
          await prisma.game.findUnique({
            where: { id },
            select: { mName: true, libraryId: true, libraryPath: true },
          }),
          { gameId: id, gameVersions: { some: { platform } } },
        ];
      case "redist":
        return [
          await prisma.redist.findUnique({
            where: { id },
            select: { mName: true, libraryId: true, libraryPath: true },
          }),
          { redistId: id },
        ];
    }
    return undefined;
  }

  private createVersionOptions(
    id: string,
    currentIndex: number,
    metadata: typeof ImportVersion.infer,
  ): Omit<
    VersionCreateInput,
    "versionPath" | "versionName" | "dropletManifest"
  > {
    const installCreator = {
      install: {
        create: {
          name: "",
          description: "",
          command: metadata.install!,
          args: metadata.installArgs || "",
        },
      },
    } satisfies Partial<GameVersionCreateInput>;

    const uninstallCreator = {
      uninstall: {
        create: {
          name: "",
          description: "",
          command: metadata.uninstall!,
          args: metadata.uninstallArgs || "",
        },
      },
    } satisfies Partial<GameVersionCreateInput>;

    switch (metadata.mode) {
      case "game": {
        return {
          versionIndex: currentIndex,
          game: {
            connect: {
              id,
            },
          },
          gameVersions: {
            create: {
              delta: metadata.delta,
              umuIdOverride: metadata.umuId,

              onlySetup: metadata.onlySetup,

              launches: {
                createMany: {
                  data: metadata.launches.map(
                    (v) =>
                      ({
                        name: v.name,
                        description: v.description,
                        command: v.launchCommand,
                        args: v.launchArgs,
                      }) satisfies LaunchOptionCreateManyInput,
                  ),
                },
              },

              ...(metadata.install ? installCreator : undefined),
              ...(metadata.uninstall ? uninstallCreator : undefined),

              platform: {
                connect: {
                  id: metadata.platform,
                },
              },
            },
          },
        };
      }
      case "redist":
        return {
          versionIndex: currentIndex,
          redist: {
            connect: {
              id,
            },
          },
          redistVersions: {
            create: {
              versionIndex: currentIndex,
              delta: metadata.delta,

              launches: {
                createMany: {
                  data: metadata.launches.map(
                    (v) =>
                      ({
                        name: v.name,
                        description: v.description,
                        command: v.launchCommand,
                        args: v.launchArgs,
                      }) satisfies LaunchOptionCreateManyInput,
                  ),
                },
              },

              ...(metadata.install ? installCreator : undefined),
              ...(metadata.uninstall ? uninstallCreator : undefined),

              platform: {
                connect: {
                  id: metadata.platform,
                },
              },
            },
          },
        };
    }
  }

  /**
   * Fetches recommendations and extra data about the version. Doesn't actually check if it's been imported.
   * @param id
   * @param version
   * @returns
   */
  async fetchUnimportedVersionInformation(
    id: string,
    mode: VersionImportMode,
    version: string,
  ) {
    const value = await this.fetchLibraryPath(id, mode);
    if (!value?.[0] || !value[0].libraryId) return undefined;
    const [libraryDetails] = value;

    const library = this.libraries.get(libraryDetails.libraryId);
    if (!library) return undefined;

    const userPlatforms = await prisma.userPlatform.findMany({});

    const fileExts: { [key: string]: string[] } = {
      Linux: [
        // Ext for Unity games
        ".x86_64",
        // Shell scripts
        ".sh",
        // No extension is common for Linux binaries
        "",
        // AppImages
        ".appimage",
      ],
      Windows: [".exe", ".bat"],
      macOS: [
        // App files
        ".app",
      ],
    };

    for (const platform of userPlatforms) {
      fileExts[platform.id] = platform.fileExtensions;
    }

    const options: Array<{
      filename: string;
      platform: string;
      match: number;
    }> = [];

    const files = await library.versionReaddir(
      libraryDetails.libraryPath,
      version,
    );
    for (const filename of files) {
      const basename = path.basename(filename);
      const dotLocation = filename.lastIndexOf(".");
      const ext =
        dotLocation == -1 ? "" : filename.slice(dotLocation).toLowerCase();
      for (const [platform, checkExts] of Object.entries(fileExts)) {
        for (const checkExt of checkExts) {
          if (checkExt != ext) continue;
          const fuzzyValue = fuzzy(basename, libraryDetails.mName);
          options.push({
            filename,
            platform,
            match: fuzzyValue,
          });
        }
      }
    }

    const sortedOptions = options.sort((a, b) => b.match - a.match);

    return sortedOptions;
  }

  // Checks are done in least to most expensive order
  async checkUnimportedGamePath(libraryId: string, libraryPath: string) {
    const hasGame =
      (await prisma.game.count({
        where: { libraryId, libraryPath },
      })) > 0;
    if (hasGame) return false;

    const hasRedist =
      (await prisma.redist.count({ where: { libraryId, libraryPath } })) > 0;
    if (hasRedist) return false;

    return true;
  }

  /*
  Game creation happens in metadata, because it's primarily a metadata object

  async createGame(libraryId: string, libraryPath: string, game: Omit<Game, "libraryId" | "libraryPath">) {

  }
  */

  async importVersion(
    id: string,
    version: string,
    metadata: typeof ImportVersion.infer,
  ) {
    const taskId = createVersionImportTaskId(id, version);

    if (metadata.mode === "game") {
      if (metadata.onlySetup) {
        if (!metadata.install)
          throw createError({
            statusCode: 400,
            message: "An install command is required in only-setup mode.",
          });
      } else {
        if (!metadata.delta && metadata.launches.length == 0)
          throw createError({
            statusCode: 400,
            message:
              "At least one launch command is required in non-delta, non-setup mode.",
          });
      }
    }

    const platform = await convertIDToLink(metadata.platform);
    if (!platform)
      throw createError({ statusCode: 400, message: "Invalid platform." });

    const value = await this.fetchLibraryPath(id, metadata.mode, platform);
    if (!value || !value[0])
      throw createError({
        statusCode: 400,
        message: `${metadata.mode} not found.`,
      });
    const [libraryDetails, idFilter] = value;

    const library = this.libraries.get(libraryDetails.libraryId);
    if (!library)
      throw createError({
        statusCode: 500,
        message: "Library not found but exists in database?",
      });

    const currentIndex = await prisma.version.count({
      where: { ...idFilter },
    });

    if (metadata.delta && currentIndex == 0)
      throw createError({
        statusCode: 400,
        message:
          "At least one pre-existing version of the same platform is required for delta mode.",
      });

    taskHandler.create({
      id: taskId,
      taskGroup: "import:game",
      name: `Importing version "${metadata.name}" (${version}) for ${libraryDetails.mName}`,
      acls: ["system:import:version:read"],
      async run({ progress, logger }) {
        // First, create the manifest via droplet.
        // This takes up 90% of our progress, so we wrap it in a *0.9
        const manifest = await library.generateDropletManifest(
          libraryDetails.libraryPath,
          version,
          (err, value) => {
            if (err) throw err;
            progress(value * 0.9);
          },
          (err, value) => {
            if (err) throw err;
            logger.info(value);
          },
        );

        logger.info("Created manifest successfully!");

        // Then, create the database object
        const createdVersion = await prisma.version.create({
          data: {
            versionPath: version,
            versionName: metadata.name ?? version,
            dropletManifest: manifest,

            ...libraryManager.createVersionOptions(id, currentIndex, metadata),
          },
        });

        logger.info("Successfully created version!");

        notificationSystem.systemPush({
          nonce: `version-create-${id}-${version}`,
          title: `'${libraryDetails.mName}' ('${version}') finished importing.`,
          description: `Drop finished importing version ${version} for ${libraryDetails.mName}.`,
          actions: [`View|/admin/library/${modeToLink[metadata.mode]}/${id}`],
          acls: ["system:import:version:read"],
        });

        if (metadata.mode === "game") {
          await libraryManager.cacheCombinedGameSize(id);
          await libraryManager.cacheGameVersionSize(
            id,
            createdVersion.versionId,
          );
        }

        progress(100);
      },
    });

    return taskId;
  }

  async peekFile(
    libraryId: string,
    game: string,
    version: string,
    filename: string,
  ) {
    const library = this.libraries.get(libraryId);
    if (!library) return undefined;
    return await library.peekFile(game, version, filename);
  }

  async readFile(
    libraryId: string,
    game: string,
    version: string,
    filename: string,
    options?: { start?: number; end?: number },
  ) {
    const library = this.libraries.get(libraryId);
    if (!library) return undefined;
    return await library.readFile(game, version, filename, options);
  }

  async deleteGameVersion(versionId: string) {
    const version = await prisma.version.delete({
      where: {
        versionId,
      },
      include: {
        game: true,
      },
    });

    if (version.game) {
      await gameSizeManager.deleteGameVersion(
        version.game.id,
        version.versionId,
      );
    }
  }

  async deleteGame(gameId: string) {
    await prisma.game.delete({
      where: {
        id: gameId,
      },
    });
    gameSizeManager.deleteGame(gameId);
  }

  async getGameVersionSize(
    gameId: string,
    versionId?: string,
  ): Promise<number | null> {
    return gameSizeManager.getGameVersionSize(gameId, versionId);
  }

  async getBiggestGamesCombinedVersions(top: number) {
    if (await gameSizeManager.isGameSizesCacheEmpty()) {
      await gameSizeManager.cacheAllCombinedGames();
    }
    return gameSizeManager.getBiggestGamesAllVersions(top);
  }

  async getBiggestGamesLatestVersions(top: number) {
    if (await gameSizeManager.isGameVersionsSizesCacheEmpty()) {
      await gameSizeManager.cacheAllGameVersions();
    }
    return gameSizeManager.getBiggestGamesLatestVersion(top);
  }

  async cacheCombinedGameSize(gameId: string) {
    const game = await prisma.game.findFirst({ where: { id: gameId } });
    if (!game) {
      return;
    }
    await gameSizeManager.cacheCombinedGame(game);
  }

  async cacheGameVersionSize(gameId: string, versionId: string) {
    const game = await prisma.game.findFirst({
      where: { id: gameId },
      include: { versions: true },
    });
    if (!game) {
      return;
    }
    await gameSizeManager.cacheGameVersion(game, versionId);
  }
}

export const libraryManager = new LibraryManager();
export default libraryManager;
