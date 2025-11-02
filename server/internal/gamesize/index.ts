import cacheHandler from "../cache";
import prisma from "../db/database";
import manifestGenerator from "../downloads/manifest";
import { replaceItem, sum } from "../../../utils/array";
import type { DropChunk, DropManifest } from "../downloads/manifest";
import type { GameVersion } from "~/prisma/client/client";

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

  async getCombinedGameSize(gameId: string) {
    const versions = await prisma.gameVersion.findMany({
      where: { gameId },
    });
    const sizes = await Promise.all(
      versions.map((version) =>
        manifestGenerator.calculateManifestSize(
          version.dropletManifest as string,
        ),
      ),
    );
    return sum(sizes);
  }

  async getGameSize(
    gameId: string,
    versionName?: string,
  ): Promise<number | null> {
    let isLatest = false;
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
      isLatest = true;
    }
    const cached = await this.gameVersionsSizesCache.get(gameId);
    if (cached !== null && versionName in cached) {
      return cached[versionName].size;
    }

    const game = await prisma.game.findFirst({ where: { id: gameId } });
    if (!game) {
      return null;
    }
    const manifest = await manifestGenerator.generateManifest(
      gameId,
      versionName,
    );
    if (!manifest) {
      return null;
    }

    const size = sum(
      (Object.values(manifest) as DropChunk[])
        .map((chunk) => chunk.lengths)
        .flat(),
    );

    await this.gameVersionsSizesCache.set(gameId, {
      [versionName]: {
        size,
        gameName: game.mName,
        gameId: game.id,
        latest: isLatest,
      },
    });

    return size;
  }

  private async isLatestVersion(
    gameVersions: GameVersion[],
    version: GameVersion,
  ): Promise<boolean> {
    return gameVersions.length > 0
      ? gameVersions[0].versionName === version.versionName
      : false;
  }

  private async cacheNonCachedLatestGames() {
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

    await Promise.all(
      games.map(async (game) => {
        return await Promise.all(
          game.versions.map(async (version) => {
            const size = await this.getGameSize(game.id, version.versionName);
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
          }),
        );
      }),
    );
  }

  async getBiggestGamesLatestVersion(top: number): Promise<VersionSize[]> {
    await this.cacheNonCachedLatestGames();
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

  private async addGameVersionsSizes(versions: GameSize[]) {
    return versions.reduce(
      (accumulator: GameSize[], currentValue: GameSize): GameSize[] => {
        const gameWithSize = accumulator.find(
          (game) => game.gameId === currentValue.gameId,
        );
        const accumulatedGameWithSize = {
          ...currentValue,
          size: gameWithSize
            ? gameWithSize.size + currentValue.size
            : currentValue.size,
        };
        return gameWithSize
          ? replaceItem(
              accumulator,
              accumulatedGameWithSize,
              accumulator.indexOf(gameWithSize),
            )
          : [...accumulator, accumulatedGameWithSize];
      },
      [],
    );
  }

  private async cacheNonCachedAllGames() {
    const games = await prisma.game.findMany({ include: { versions: true } });

    await Promise.all(
      games.map(async (game) => {
        const size = await this.getCombinedGameSize(game.id);
        if (!size) {
          return;
        }
        const gameSize = {
          size,
          gameName: game.mName,
          gameId: game.id,
        };
        await this.gameSizesCache.set(game.id, gameSize);
      }),
    );
  }

  async getBiggestGamesAllVersions(top: number): Promise<GameSize[]> {
    await this.cacheNonCachedAllGames();
    const gameIds = await this.gameSizesCache.getKeys();
    const allGames = await Promise.all(
      gameIds.map(async (gameId) => await this.gameSizesCache.get(gameId)),
    );
    return allGames
      .filter((game) => game !== null)
      .sort((gameA, gameB) => gameB.size - gameA.size)
      .slice(0, top);
  }

  async invalidateCache(key: string) {
    await this.gameVersionsSizesCache.remove(key);
  }
}

export const manager = new GameSizeManager();
export default manager;
