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
import type { GameModel } from "~/prisma/client/models";
import { createHash } from "node:crypto";
import type { WorkingLibrarySource } from "~/server/api/v1/admin/library/sources/index.get";
import gameSizeManager from "~/server/internal/gamesize";
import { TORRENTIAL_SERVICE } from "../services/services/torrential";
import type { ImportVersion } from "~/server/api/v1/admin/import/version/index.post";
import { GameType, type Platform } from "~/prisma/client/enums";
import { castManifest } from "./manifest";

export function createGameImportTaskId(libraryId: string, libraryPath: string) {
  return createHash("md5")
    .update(`import:${libraryId}:${libraryPath}`)
    .digest("hex");
}

export function createVersionImportTaskKey(
  gameId: string,
  versionName: string,
) {
  return createHash("md5")
    .update(`import:${gameId}:${versionName}`)
    .digest("hex");
}

export interface ExecutorVersionGuess {
  type: "executor";
  executorId: string;
  icon: string;
  gameName: string;
  versionName: string;
  launchName: string;
  platform: Platform;
}
export interface PlatformVersionGuess {
  platform: Platform;
  type: "platform";
}
export type VersionGuess = {
  filename: string;
  match: number;
} & (PlatformVersionGuess | ExecutorVersionGuess);

export interface UnimportedVersionInformation {
  type: "local" | "depot";
  name: string;
  identifier: string;
}

class LibraryManager {
  private libraries: Map<string, LibraryProvider<unknown>> = new Map();

  addLibrary(library: LibraryProvider<unknown>) {
    this.libraries.set(library.id(), library);
  }

  removeLibrary(id: string) {
    this.libraries.delete(id);
  }

  getLibrary(libraryId: string): LibraryProvider<unknown> | undefined {
    return this.libraries.get(libraryId);
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
    const results: { [key: string]: { [key: string]: GameModel } } = {};
    const games = await prisma.game.findMany({});
    for (const game of games) {
      const libraryId = game.libraryId!;
      const libraryPath = game.libraryPath!;

      results[libraryId] ??= {};
      results[libraryId][libraryPath] = game;
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
          !taskHandler.hasTaskKey(createGameImportTaskId(id, libraryPath)),
      );
      unimportedGames[id] = providerUnimportedGames;
    }

    return unimportedGames;
  }

  async fetchUnimportedGameVersions(
    libraryId: string,
    libraryPath: string,
  ): Promise<UnimportedVersionInformation[] | undefined> {
    const provider = this.libraries.get(libraryId);
    if (!provider) return undefined;
    const game = await prisma.game.findUnique({
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
    });
    if (!game) return undefined;

    try {
      const versions = await provider.listVersions(
        libraryPath,
        game.versions.map((v) => v.versionPath).filter((v) => v !== null),
      );
      const unimportedVersions = versions
        .filter(
          (e) =>
            game.versions.findIndex((v) => v.versionPath == e) == -1 &&
            !taskHandler.hasTaskKey(createVersionImportTaskKey(game.id, e)),
        )
        .map(
          (v) =>
            ({
              type: "local",
              name: v,
              identifier: v,
            }) satisfies UnimportedVersionInformation,
        );
      const depotVersions = await prisma.unimportedGameVersion.findMany({
        where: {
          gameId: game.id,
        },
        select: {
          versionName: true,
          id: true,
        },
      });
      const mappedDepotVersions = depotVersions.map(
        (v) =>
          ({
            type: "depot",
            name: v.versionName,
            identifier: v.id,
          }) satisfies UnimportedVersionInformation,
      );
      return [...unimportedVersions, ...mappedDepotVersions];
    } catch (e) {
      if (e instanceof GameNotFoundError) {
        logger.warn(e);
        return undefined;
      }
      throw e;
    }
  }

  async fetchGamesWithStatus() {
    const games = await prisma.game.findMany({
      include: {
        library: true,
        versions: true,
      },
      orderBy: {
        mName: "asc",
      },
    });

    return await Promise.all(
      games.map(async (e) => {
        const versions = await this.fetchUnimportedGameVersions(
          e.libraryId ?? "",
          e.libraryPath,
        );
        return {
          game: e,
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

  /**
   * Fetches recommendations and extra data about the version. Doesn't actually check if it's been imported.
   * @param gameId
   * @param versionIdentifier
   * @returns
   */
  async fetchUnimportedVersionInformation(
    gameId: string,
    versionIdentifier: Omit<UnimportedVersionInformation, "name">,
  ) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { libraryPath: true, libraryId: true, mName: true },
    });
    if (!game || !game.libraryId) return undefined;

    const library = this.libraries.get(game.libraryId);
    if (!library) return undefined;

    const fileExts: { [key in Platform]: string[] } = {
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

    const executorSuggestions = await prisma.launchConfiguration.findMany({
      where: {
        executorSuggestions: {
          isEmpty: false,
        },
        gameVersion: {
          game: {
            type: GameType.Executor,
          },
        },
      },
      select: {
        executorSuggestions: true,
        gameVersion: {
          select: {
            game: {
              select: {
                mIconObjectId: true,
                mName: true,
              },
            },
            displayName: true,
            versionPath: true,
          },
        },
        name: true,
        launchId: true,
        platform: true,
      },
    });

    const options: Array<VersionGuess> = [];

    let files;
    if (versionIdentifier.type === "local") {
      files = await library.versionReaddir(
        game.libraryPath,
        versionIdentifier.identifier,
      );
    } else if (versionIdentifier.type === "depot") {
      const unimported = await prisma.unimportedGameVersion.findUnique({
        where: {
          id: versionIdentifier.identifier,
        },
        select: {
          fileList: true,
        },
      });
      if (!unimported) return undefined;
      files = unimported.fileList;
    } else {
      return undefined;
    }

    for (const filename of files) {
      const basename = path.basename(filename);
      const dotLocation = filename.lastIndexOf(".");
      const ext =
        dotLocation == -1 ? "" : filename.slice(dotLocation).toLowerCase();
      for (const [platform, checkExts] of Object.entries(fileExts)) {
        for (const checkExt of checkExts) {
          if (checkExt != ext) continue;
          const fuzzyValue = fuzzy(basename, game.mName);
          options.push({
            type: "platform",
            filename: filename.replaceAll(" ", "\\ "),
            platform: platform as Platform,
            match: fuzzyValue,
          });
        }
      }
      for (const executorSuggestion of executorSuggestions) {
        for (const suggestion of executorSuggestion.executorSuggestions) {
          if (suggestion != ext) continue;
          const fuzzyValue = fuzzy(basename, game.mName);
          options.push({
            type: "executor",
            filename: filename.replaceAll(" ", "\\ "),
            match: fuzzyValue,
            executorId: executorSuggestion.launchId,

            icon: executorSuggestion.gameVersion.game.mIconObjectId,
            gameName: executorSuggestion.gameVersion.game.mName,
            versionName: (executorSuggestion.gameVersion.displayName ??
              executorSuggestion.gameVersion.versionPath)!,
            launchName: executorSuggestion.name,
            platform: executorSuggestion.platform,
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

    return true;
  }

  /*
  Game creation happens in metadata, because it's primarily a metadata object

  async createGame(libraryId: string, libraryPath: string, game: Omit<Game, "libraryId" | "libraryPath">) {

  }
  */

  async importVersion(
    gameId: string,
    version: UnimportedVersionInformation,
    metadata: typeof ImportVersion.infer,
  ) {
    const taskKey = createVersionImportTaskKey(gameId, version.identifier);

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { mName: true, libraryId: true, libraryPath: true, type: true },
    });
    if (!game || !game.libraryId) return undefined;

    if (game.type === GameType.Redist && !metadata.onlySetup)
      throw createError({
        statusCode: 400,
        message: "Redistributables can only be in setup-only mode.",
      });

    const library = this.libraries.get(game.libraryId);
    if (!library) return undefined;

    const unimportedVersion =
      version.type === "depot"
        ? await prisma.unimportedGameVersion.findUnique({
            where: { id: version.identifier },
          })
        : undefined;

    return await taskHandler.create({
      key: taskKey,
      taskGroup: "import:game",
      name: `Importing version ${version.name} for ${game.mName}`,
      acls: ["system:import:version:read"],
      async run({ progress, logger }) {
        let versionPath: string | null = null;
        let manifest;
        let fileList;

        if (version.type === "local") {
          versionPath = version.identifier;
          // First, create the manifest via droplet.
          // This takes up 90% of our progress, so we wrap it in a *0.9

          manifest = await library.generateDropletManifest(
            game.libraryPath,
            versionPath,
            (err, value) => {
              if (err) throw err;
              progress(value * 0.9);
            },
            (err, value) => {
              if (err) throw err;
              logger.info(value);
            },
          );
          fileList = await library.versionReaddir(
            game.libraryPath,
            versionPath,
          );
          logger.info("Created manifest successfully!");
        } else if (version.type === "depot" && unimportedVersion) {
          manifest = castManifest(unimportedVersion.manifest);
          fileList = unimportedVersion.fileList;
          progress(90);
        } else {
          throw "Could not find or create manifest for this version.";
        }

        const currentIndex = await prisma.gameVersion.count({
          where: { gameId: gameId },
        });

        // Then, create the database object
        const newVersion = await prisma.gameVersion.create({
          data: {
            game: {
              connect: {
                id: gameId,
              },
            },

            displayName: metadata.displayName ?? null,

            versionPath,
            dropletManifest: manifest,
            fileList,
            versionIndex: currentIndex,
            delta: metadata.delta,

            onlySetup: metadata.onlySetup,
            setups: {
              createMany: {
                data: metadata.setups.map((v) => ({
                  command: v.launch,
                  platform: v.platform,
                })),
              },
            },

            launches: {
              createMany: !metadata.onlySetup
                ? {
                    data: metadata.launches.map((v) => ({
                      name: v.name,
                      command: v.launch,
                      platform: v.platform,
                      ...(v.executorId && game.type === "Game"
                        ? {
                            executorId: v.executorId,
                          }
                        : undefined),
                      executorSuggestions:
                        game.type === "Executor" ? (v.suggestions ?? []) : [],
                    })),
                  }
                : { data: [] },
            },
          },
        });
        logger.info("Successfully created version!");

        notificationSystem.systemPush({
          nonce: `version-create-${gameId}-${version}`,
          title: `'${game.mName}' ('${version}') finished importing.`,
          description: `Drop finished importing version ${version} for ${game.mName}.`,
          actions: [`View|/admin/library/${gameId}`],
          acls: ["system:import:version:read"],
        });

        await libraryManager.cacheCombinedGameSize(gameId);
        await libraryManager.cacheGameVersionSize(gameId, newVersion.versionId);

        await TORRENTIAL_SERVICE.utils().invalidate(
          gameId,
          newVersion.versionId,
        );

        if (version.type === "depot") {
          // SAFETY: we can only reach this if the type is depot and identifier is valid
          // eslint-disable-next-line drop/no-prisma-delete
          await prisma.unimportedGameVersion.delete({
            where: {
              id: version.identifier,
            },
          });
        }
        progress(100);
      },
    });
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

  async deleteGameVersion(gameId: string, version: string) {
    await prisma.gameVersion.deleteMany({
      where: {
        gameId: gameId,
        versionId: version,
      },
    });

    await gameSizeManager.deleteGameVersion(gameId, version);
  }

  async deleteGame(gameId: string) {
    await prisma.game.deleteMany({
      where: {
        id: gameId,
      },
    });
    await gameSizeManager.deleteGame(gameId);
    // Delete all game versions that depended on this game
    await prisma.gameVersion.deleteMany({
      where: {
        launches: {
          some: {
            executor: {
              gameVersion: {
                gameId,
              },
            },
          },
        },
      },
    });
  }

  async getGameVersionSize(
    gameId: string,
    versionName?: string,
  ): Promise<number | null> {
    return gameSizeManager.getGameVersionSize(gameId, versionName);
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
