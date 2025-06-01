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
import type { LibraryProvider } from "./provider";

class LibraryManager {
  private libraries: Map<string, LibraryProvider<unknown>> = new Map();

  addLibrary(library: LibraryProvider<unknown>) {
    this.libraries.set(library.id(), library);
  }

  async fetchAllUnimportedGames() {
    const unimportedGames: { [key: string]: string[] } = {};

    for (const [id, library] of this.libraries.entries()) {
      const games = await library.listGames();
      const validGames = await prisma.game.findMany({
        where: {
          libraryId: id,
          libraryPath: { in: games },
        },
        select: {
          libraryPath: true,
        },
      });
      const providerUnimportedGames = games.filter(
        (e) => validGames.findIndex((v) => v.libraryPath == e) == -1,
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
        versions: true,
      },
    });
    if (!game) return undefined;

    const versions = await provider.listVersions(libraryPath);
    const unimportedVersions = versions.filter(
      (e) => game.versions.findIndex((v) => v.versionName == e) == -1,
    );

    return unimportedVersions;
  }

  async fetchGamesWithStatus() {
    const games = await prisma.game.findMany({
      select: {
        id: true,
        versions: true,
        mName: true,
        mShortDescription: true,
        metadataSource: true,
        mIconObjectId: true,
        libraryId: true,
        libraryPath: true,
      },
      orderBy: {
        mName: "asc",
      },
    });

    return await Promise.all(
      games.map(async (e) => ({
        game: e,
        status: {
          noVersions: e.versions.length == 0,
          unimportedVersions: (await this.fetchUnimportedGameVersions(
            e.libraryId ?? "",
            e.libraryPath,
          ))!,
        },
      })),
    );
  }

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
      Windows: [
        // Pretty much the only one
        ".exe",
      ],
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
    for (const file of files) {
      const filename = path.basename(file);
      const dotLocation = file.lastIndexOf(".");
      const ext = dotLocation == -1 ? "" : file.slice(dotLocation);
      for (const [platform, checkExts] of Object.entries(fileExts)) {
        for (const checkExt of checkExts) {
          if (checkExt != ext) continue;
          const fuzzyValue = fuzzy(filename, game.mName);
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
      (await prisma.game.count({ where: { libraryId, libraryPath } })) > 0;
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

    taskHandler.create({
      id: taskId,
      name: `Importing version ${versionName} for ${game.mName}`,
      acls: ["system:import:version:read"],
      async run({ progress, log }) {
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
            log(value);
          },
        );

        log("Created manifest successfully!");

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

        log("Successfully created version!");

        notificationSystem.systemPush({
          nonce: `version-create-${gameId}-${versionName}`,
          title: `'${game.mName}' ('${versionName}') finished importing.`,
          description: `Drop finished importing version ${versionName} for ${game.mName}.`,
          actions: [`View|/admin/library/${gameId}`],
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
