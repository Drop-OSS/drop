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
import type { GameModel } from "~/prisma/client/models";

class LibraryManager {
  private libraries: Map<string, LibraryProvider<unknown>> = new Map();

  private gameImportLocks: Map<string, Array<string>> = new Map(); // Library ID to Library Path
  private versionImportLocks: Map<string, Array<string>> = new Map(); // Game ID to Version Name

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
      const locks = this.gameImportLocks.get(id) ?? [];
      const providerUnimportedGames = providerGames.filter(
        (libraryPath) =>
          instanceGames[id] &&
          !instanceGames[id][libraryPath] &&
          !locks.includes(libraryPath),
      );
      unimportedGames[id] = providerUnimportedGames;
    }

    return unimportedGames;
  }

  async fetchUnimportedGameVersions(libraryId: string, libraryPath: string) {
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
      const versions = await provider.listVersions(libraryPath);
      const unimportedVersions = versions.filter(
        (e) =>
          game.versions.findIndex((v) => v.versionName == e) == -1 &&
          !(this.versionImportLocks.get(game.id) ?? []).includes(e),
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
          omit: {
            dropletManifest: true,
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
      const ext = dotLocation == -1 ? "" : filename.slice(dotLocation);
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

    return true;
  }

  /*
  Game creation happens in metadata, because it's primarily a metadata object

  async createGame(libraryId: string, libraryPath: string, game: Omit<Game, "libraryId" | "libraryPath">) {

  }
  */

  /**
   * Locks the game so you can't be imported
   * @param libraryId
   * @param libraryPath
   */
  async lockGame(libraryId: string, libraryPath: string) {
    let games = this.gameImportLocks.get(libraryId);
    if (!games) this.gameImportLocks.set(libraryId, (games = []));

    if (!games.includes(libraryPath)) games.push(libraryPath);

    this.gameImportLocks.set(libraryId, games);
  }

  /**
   * Unlocks the game, call once imported
   * @param libraryId
   * @param libraryPath
   */
  async unlockGame(libraryId: string, libraryPath: string) {
    let games = this.gameImportLocks.get(libraryId);
    if (!games) this.gameImportLocks.set(libraryId, (games = []));

    if (games.includes(libraryPath))
      games.splice(
        games.findIndex((e) => e === libraryPath),
        1,
      );

    this.gameImportLocks.set(libraryId, games);
  }

  /**
   * Locks a version so it can't be imported
   * @param gameId
   * @param versionName
   */
  async lockVersion(gameId: string, versionName: string) {
    let versions = this.versionImportLocks.get(gameId);
    if (!versions) this.versionImportLocks.set(gameId, (versions = []));

    if (!versions.includes(versionName)) versions.push(versionName);

    this.versionImportLocks.set(gameId, versions);
  }

  /**
   * Unlocks the version, call once imported
   * @param libraryId
   * @param libraryPath
   */
  async unlockVersion(gameId: string, versionName: string) {
    let versions = this.versionImportLocks.get(gameId);
    if (!versions) this.versionImportLocks.set(gameId, (versions = []));

    if (versions.includes(gameId))
      versions.splice(
        versions.findIndex((e) => e === versionName),
        1,
      );

    this.versionImportLocks.set(gameId, versions);
  }

  async importVersion(
    gameId: string,
    versionName: string,
    metadata: {
      platform: string;
      onlySetup: boolean;

      setup: string;
      setupArgs: string;
      launch: string;
      launchArgs: string;
      delta: boolean;

      umuId: string;
    },
  ) {
    const taskId = `import:${gameId}:${versionName}`;

    const platform = parsePlatform(metadata.platform);
    if (!platform) return undefined;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { mName: true, libraryId: true, libraryPath: true },
    });
    if (!game || !game.libraryId) return undefined;

    const library = this.libraries.get(game.libraryId);
    if (!library) return undefined;

    await this.lockVersion(gameId, versionName);

    taskHandler.create({
      id: taskId,
      taskGroup: "import:game",
      name: `Importing version ${versionName} for ${game.mName}`,
      acls: ["system:import:version:read"],
      async run({ progress, logger }) {
        // First, create the manifest via droplet.
        // This takes up 90% of our progress, so we wrap it in a *0.9
        const manifest = await library.generateDropletManifest(
          game.libraryPath,
          versionName,
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
          where: { gameId: gameId },
        });

        // Then, create the database object
        if (metadata.onlySetup) {
          await prisma.gameVersion.create({
            data: {
              gameId: gameId,
              versionName: versionName,
              dropletManifest: manifest,
              versionIndex: currentIndex,
              delta: metadata.delta,
              umuIdOverride: metadata.umuId,
              platform: platform,

              onlySetup: true,
              setupCommand: metadata.setup,
              setupArgs: metadata.setupArgs.split(" "),
            },
          });
        } else {
          await prisma.gameVersion.create({
            data: {
              gameId: gameId,
              versionName: versionName,
              dropletManifest: manifest,
              versionIndex: currentIndex,
              delta: metadata.delta,
              umuIdOverride: metadata.umuId,
              platform: platform,

              onlySetup: false,
              setupCommand: metadata.setup,
              setupArgs: metadata.setupArgs.split(" "),
              launchCommand: metadata.launch,
              launchArgs: metadata.launchArgs.split(" "),
            },
          });
        }

        logger.info("Successfully created version!");

        notificationSystem.systemPush({
          nonce: `version-create-${gameId}-${versionName}`,
          title: `'${game.mName}' ('${versionName}') finished importing.`,
          description: `Drop finished importing version ${versionName} for ${game.mName}.`,
          actions: [`View|/admin/library/${gameId}`],
          acls: ["system:import:version:read"],
        });

        progress(100);
      },
      async finally() {
        await libraryManager.unlockVersion(gameId, versionName);
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
    return library.peekFile(game, version, filename);
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
    return library.readFile(game, version, filename, options);
  }
}

export const libraryManager = new LibraryManager();
export default libraryManager;
