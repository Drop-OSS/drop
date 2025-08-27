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
import { parsePlatform } from "../utils/parseplatform";
import notificationSystem from "../notifications";
import { GameNotFoundError, type LibraryProvider } from "./provider";
import { logger } from "../logging";
import { createHash } from "node:crypto";
import type { ImportVersion } from "~/server/api/v1/admin/import/version/index.post";
import type { LaunchOptionCreateManyGameVersionInput } from "~/prisma/client/models";

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

  async fetchLibraries() {
    const libraries = await prisma.library.findMany({});
    const libraryWithMetadata = libraries.map((e) => ({
      ...e,
      working: this.libraries.has(e.id),
    }));
    return libraryWithMetadata;
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

  async fetchGamesWithStatus() {
    const games = await prisma.game.findMany({
      include: {
        versions: {
          select: {
            versionName: true,
          },
        },
        library: true,
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
   * @param versionName
   * @returns
   */
  async fetchUnimportedVersionInformation(gameId: string, versionName: string) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { libraryPath: true, libraryId: true, mName: true },
    });
    if (!game || !game.libraryId) return undefined;

    const library = this.libraries.get(game.libraryId);
    if (!library) return undefined;

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

    const options: Array<{
      filename: string;
      platform: string;
      match: number;
    }> = [];

    const files = await library.versionReaddir(game.libraryPath, versionName);
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
    gameId: string,
    versionPath: string,
    metadata: typeof ImportVersion.infer,
  ) {
    const taskId = createVersionImportTaskId(gameId, versionPath);

    const platform = parsePlatform(metadata.platform);
    if (!platform) return undefined;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { mName: true, libraryId: true, libraryPath: true },
    });
    if (!game || !game.libraryId) return undefined;

    const library = this.libraries.get(game.libraryId);
    if (!library) return undefined;

    taskHandler.create({
      id: taskId,
      taskGroup: "import:game",
      name: `Importing version "${metadata.name}" (${versionPath}) for ${game.mName}`,
      acls: ["system:import:version:read"],
      async run({ progress, logger }) {
        // First, create the manifest via droplet.
        // This takes up 90% of our progress, so we wrap it in a *0.9
        const manifest = await library.generateDropletManifest(
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

        logger.info("Created manifest successfully!");

        const currentIndex = await prisma.gameVersion.count({
          where: { version: { gameId: gameId } },
        });

        // Then, create the database object
        await prisma.version.create({
          data: {
            gameId,
            versionPath: versionPath,
            versionName: metadata.name ?? versionPath,
            dropletManifest: manifest,
            platform: platform,

            gameVersion: {
              create: {
                versionIndex: currentIndex,
                delta: metadata.delta,
                umuIdOverride: metadata.umuId,

                onlySetup: metadata.onlySetup,
                setupCommand: metadata.setup,
                setupArgs: metadata.setupArgs,

                launches: {
                  createMany: {
                    data: metadata.launches.map(
                      (v) =>
                        ({
                          name: v.name,
                          description: v.description,
                          launchCommand: v.launchCommand,
                          launchArgs: v.launchArgs,
                        }) satisfies LaunchOptionCreateManyGameVersionInput,
                    ),
                  },
                },
              },
            },
          },
        });

        logger.info("Successfully created version!");

        notificationSystem.systemPush({
          nonce: `version-create-${gameId}-${versionPath}`,
          title: `'${game.mName}' ('${versionPath}') finished importing.`,
          description: `Drop finished importing version ${versionPath} for ${game.mName}.`,
          actions: [`View|/admin/library/g/${gameId}`],
          acls: ["system:import:version:read"],
        });

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
}

export const libraryManager = new LibraryManager();
export default libraryManager;
