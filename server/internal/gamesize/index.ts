import cacheHandler from "../cache";
import prisma from "../db/database";
import manifestGenerator from "../downloads/manifest";
import { sum } from "../../../utils/array";
import type { Game, GameVersion } from "~/prisma/client/client";

export type GameSize = {
  gameName: string;
  size: number;
  gameId: string;
};

export type VersionSize = GameSize & {
  latest: boolean;
};

type VersionsSizes = {
  [versionName: string]: VersionSize;
};

type GameVersionsSize = {
  [gameId: string]: VersionsSizes;
};

class GameSizeManager {
  private gameVersionsSizesCache =
    cacheHandler.createCache<GameVersionsSize>("gameVersionsSizes");
  // All versions sizes combined
  private gameSizesCache = cacheHandler.createCache<GameSize>("gameSizes");

  private async clearGameVersionsSizesCache() {
    (await this.gameVersionsSizesCache.getKeys()).map((key) =>
      this.gameVersionsSizesCache.remove(key),
    );
  }

  private async clearGameSizesCache() {
    (await this.gameSizesCache.getKeys()).map((key) =>
      this.gameSizesCache.remove(key),
    );
  }

  // All versions of a game combined
  async getCombinedGameSize(gameId: string) {
    const versions = await prisma.gameVersion.findMany({
      where: { gameId },
    });
    const sizes = await Promise.all(
      versions.map((version) =>
        manifestGenerator.calculateManifestSize(
          JSON.parse(version.dropletManifest as string),
        ),
      ),
    );
    return sum(sizes);
  }

  async getGameVersionSize(
    gameId: string,
    versionName?: string,
  ): Promise<number | null> {
    if (!versionName) {
      const version = await prisma.gameVersion.findFirst({
        where: { gameId },
        orderBy: {
          versionIndex: "desc",
        },
      });
      if (!version) {
        return null;
      }
      versionName = version.versionName;
    }

    const manifest = await manifestGenerator.generateManifest(
      gameId,
      versionName,
    );
    if (!manifest) {
      return null;
    }

    return manifestGenerator.calculateManifestSize(manifest);
  }

  private async isLatestVersion(
    gameVersions: GameVersion[],
    version: GameVersion,
  ): Promise<boolean> {
    return gameVersions.length > 0
      ? gameVersions[0].versionName === version.versionName
      : false;
  }

  async getBiggestGamesLatestVersion(top: number): Promise<VersionSize[]> {
    const gameIds = await this.gameVersionsSizesCache.getKeys();
    const latestGames = await Promise.all(
      gameIds.map(async (gameId) => {
        const versionsSizes = await this.gameVersionsSizesCache.get(gameId);
        if (!versionsSizes) {
          return null;
        }
        const latestVersionName = Object.keys(versionsSizes).find(
          (versionName) => versionsSizes[versionName].latest,
        );
        if (!latestVersionName) {
          return null;
        }
        return versionsSizes[latestVersionName] || null;
      }),
    );
    return latestGames
      .filter((game) => game !== null)
      .sort((gameA, gameB) => gameB.size - gameA.size)
      .slice(0, top);
  }

  async isGameVersionsSizesCacheEmpty() {
    return (await this.gameVersionsSizesCache.getKeys()).length === 0;
  }

  async isGameSizesCacheEmpty() {
    return (await this.gameSizesCache.getKeys()).length === 0;
  }

  async cacheAllCombinedGames() {
    await this.clearGameSizesCache();
    const games = await prisma.game.findMany({ include: { versions: true } });

    await Promise.all(games.map((game) => this.cacheCombinedGame(game)));
  }

  async cacheCombinedGame(game: Game) {
    const size = await this.getCombinedGameSize(game.id);
    if (!size) {
      this.gameSizesCache.remove(game.id);
      return;
    }
    const gameSize = {
      size,
      gameName: game.mName,
      gameId: game.id,
    };
    await this.gameSizesCache.set(game.id, gameSize);
  }

  async cacheAllGameVersions() {
    await this.clearGameVersionsSizesCache();
    const games = await prisma.game.findMany({
      include: {
        versions: {
          orderBy: {
            versionIndex: "desc",
          },
          take: 1,
        },
      },
    });

    await Promise.all(games.map((game) => this.cacheGameVersion(game)));
  }

  async cacheGameVersion(
    game: Game & { versions: GameVersion[] },
    versionName?: string,
  ) {
    const cacheVersion = async (version: GameVersion) => {
      const size = await this.getGameVersionSize(game.id, version.versionName);
      if (!version.versionName || !size) {
        return;
      }

      const versionsSizes = {
        [version.versionName]: {
          size,
          gameName: game.mName,
          gameId: game.id,
          latest: await this.isLatestVersion(game.versions, version),
        },
      };
      const allVersionsSizes =
        (await this.gameVersionsSizesCache.get(game.id)) || {};
      await this.gameVersionsSizesCache.set(game.id, {
        ...allVersionsSizes,
        ...versionsSizes,
      });
    };

    if (versionName) {
      const version = await prisma.gameVersion.findFirst({
        where: { gameId: game.id, versionName },
      });
      if (!version) {
        return;
      }
      cacheVersion(version);
      return;
    }
    if ("versions" in game) {
      await Promise.all(game.versions.map(cacheVersion));
    }
  }

  async getBiggestGamesAllVersions(top: number): Promise<GameSize[]> {
    const gameIds = await this.gameSizesCache.getKeys();
    const allGames = await Promise.all(
      gameIds.map(async (gameId) => await this.gameSizesCache.get(gameId)),
    );
    return allGames
      .filter((game) => game !== null)
      .sort((gameA, gameB) => gameB.size - gameA.size)
      .slice(0, top);
  }

  async deleteGameVersion(gameId: string, version: string) {
    const game = await prisma.game.findFirst({ where: { id: gameId } });
    if (game) {
      await this.cacheCombinedGame(game);
    }
    const versionsSizes = await this.gameVersionsSizesCache.get(gameId);
    if (!versionsSizes) {
      return;
    }
    // Remove the version from the VersionsSizes object
    const { [version]: _, ...updatedVersionsSizes } = versionsSizes;
    await this.gameVersionsSizesCache.set(gameId, updatedVersionsSizes);
  }

  async deleteGame(gameId: string) {
    this.gameSizesCache.remove(gameId);
    this.gameVersionsSizesCache.remove(gameId);
  }
}

export const manager = new GameSizeManager();
export default manager;
