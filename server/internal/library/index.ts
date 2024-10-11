/**
 * The Library Manager keeps track of games in Drop's library and their various states.
 * It uses path relative to the library, so it can moved without issue
 *
 * It also provides the endpoints with information about unmatched games
 */

import fs from "fs";
import path from "path";
import prisma from "../db/database";
import { GameVersion, Platform } from "@prisma/client";
import { fuzzy } from "fast-fuzzy";
import { recursivelyReaddir } from "../utils/recursivedirs";
import taskHandler from "../tasks";
import { parsePlatform } from "../utils/parseplatform";
import droplet from "@drop/droplet";

class LibraryManager {
  private basePath: string;

  constructor() {
    this.basePath = process.env.LIBRARY ?? "./.data/library";
  }

  async fetchAllUnimportedGames() {
    const dirs = fs.readdirSync(this.basePath).filter((e) => {
      const fullDir = path.join(this.basePath, e);
      return fs.lstatSync(fullDir).isDirectory();
    });

    const validGames = await prisma.game.findMany({
      where: {
        libraryBasePath: { in: dirs },
      },
      select: {
        libraryBasePath: true,
      },
    });
    const validGameDirs = validGames.map((e) => e.libraryBasePath);

    const unregisteredGames = dirs.filter((e) => !validGameDirs.includes(e));

    return unregisteredGames;
  }

  async fetchUnimportedGameVersions(
    libraryBasePath: string,
    versions: Array<GameVersion>
  ) {
    const gameDir = path.join(this.basePath, libraryBasePath);
    const versionsDirs = fs.readdirSync(gameDir);
    const importedVersionDirs = versions.map((e) => e.versionName);
    const unimportedVersions = versionsDirs.filter(
      (e) => !importedVersionDirs.includes(e)
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
        mDevelopers: true,
        mPublishers: true,
        mIconId: true,
        libraryBasePath: true,
      },
    });

    return await Promise.all(
      games.map(async (e) => ({
        game: e,
        status: {
          noVersions: e.versions.length == 0,
          unimportedVersions: await this.fetchUnimportedGameVersions(
            e.libraryBasePath,
            e.versions
          ),
        },
      }))
    );
  }

  async fetchUnimportedVersions(gameId: string) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        versions: {
          select: {
            versionName: true,
          },
        },
        libraryBasePath: true,
      },
    });

    if (!game) return undefined;
    const targetDir = path.join(this.basePath, game.libraryBasePath);
    if (!fs.existsSync(targetDir))
      throw new Error(
        "Game in database, but no physical directory? Something is very very wrong..."
      );
    const versions = fs.readdirSync(targetDir);
    const currentVersions = game.versions.map((e) => e.versionName);

    const unimportedVersions = versions.filter(
      (e) => !currentVersions.includes(e)
    );
    return unimportedVersions;
  }

  async fetchUnimportedVersionInformation(gameId: string, versionName: string) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { libraryBasePath: true, mName: true },
    });
    if (!game) return undefined;
    const targetDir = path.join(
      this.basePath,
      game.libraryBasePath,
      versionName
    );
    if (!fs.existsSync(targetDir)) return undefined;

    const fileExts: { [key: string]: string[] } = {
      Linux: [
        // Ext for Unity games
        ".x86_64",
        // No extension is common for Linux binaries
        "",
      ],
      Windows: [
        // Pretty much the only one
        ".exe",
      ],
    };

    const options: Array<{
      filename: string;
      platform: string;
      match: number;
    }> = [];

    const files = recursivelyReaddir(targetDir, 2);
    for (const file of files) {
      const filename = path.basename(file);
      const dotLocation = file.lastIndexOf(".");
      const ext = dotLocation == -1 ? "" : file.slice(dotLocation);
      for (const [platform, checkExts] of Object.entries(fileExts)) {
        for (const checkExt of checkExts) {
          if (checkExt != ext) continue;
          const fuzzyValue = fuzzy(filename, game.mName);
          options.push({
            filename: file,
            platform: platform,
            match: fuzzyValue,
          });
        }
      }
    }

    const sortedOptions = options.sort((a, b) => b.match - a.match);
    let startupGuess = "";
    let platformGuess = "";
    if (sortedOptions.length > 0) {
      const finalChoice = sortedOptions[0];
      const finalChoiceRelativePath = path.relative(
        targetDir,
        finalChoice.filename
      );
      startupGuess = finalChoiceRelativePath;
      platformGuess = finalChoice.platform;
    }

    return { startupGuess, platformGuess };
  }

  // Checks are done in least to most expensive order
  async checkUnimportedGamePath(targetPath: string) {
    const targetDir = path.join(this.basePath, targetPath);
    if (!fs.existsSync(targetDir)) return false;

    const hasGame =
      (await prisma.game.count({ where: { libraryBasePath: targetPath } })) > 0;
    if (hasGame) return false;

    return true;
  }

  async importVersion(
    gameId: string,
    versionName: string,
    metadata: { platform: string; setup: string; startup: string }
  ) {
    const taskId = `import:${gameId}:${versionName}`;

    const platform = parsePlatform(metadata.platform);
    if (!platform) return undefined;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { mName: true, libraryBasePath: true },
    });
    if (!game) return undefined;

    const baseDir = path.join(this.basePath, game.libraryBasePath, versionName);
    if (!fs.existsSync(baseDir)) return undefined;

    taskHandler.create({
      id: taskId,
      name: `Importing version ${versionName} for ${game.mName}`,
      requireAdmin: true,
      async run({ progress, log }) {
        // First, create the manifest via droplet.
        // This takes up 90% of our progress, so we wrap it in a *0.9
        const manifest = await new Promise<string>((resolve, reject) => {
          droplet.generateManifest(
            baseDir,
            (err, value) => {
              if (err) return reject(err);
              progress(value * 0.9);
            },
            (err, line) => {
              if (err) return reject(err);
              log(line);
            },
            (err, manifest) => {
              if (err) return reject(err);
              resolve(manifest);
            }
          );
        });

        log("Created manifest successfully!");

        // Then, create the database object
        const version = await prisma.gameVersion.create({
          data: {
            gameId: gameId,
            versionName: versionName,
            platform: platform,
            setupCommand: metadata.setup,
            launchCommand: metadata.startup,
            dropletManifest: manifest,
          },
        });

        log("Successfully created version!");

        progress(100);
      },
    });

    return taskId;
  }
}

export const libraryManager = new LibraryManager();
export default libraryManager;