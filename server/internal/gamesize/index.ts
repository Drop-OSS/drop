import cacheHandler from "../cache";
import prisma from "../db/database";
import { sum } from "../../../utils/array";
import { createDownloadManifestDetails } from "../library/manifest";
import { castManifest } from "../library/manifest/utils";

export type GameVersionSize = {
  versionId: string;
  installSize: number;
  downloadSize: number;
};

export type GameSizeBreakdown = {
  diskSize: number;
  versions: Array<GameVersionSize & { diskSize: number; name: string }>;
};

class GameSizeManager {
  private gameVersionsSizesCache =
    cacheHandler.createCache<GameVersionSize>("versionSizes");
  private gameBreakdownCache =
    cacheHandler.createCache<GameSizeBreakdown>("gameBreakdown");

  /***
   * Gets the size of the game to the user:
   * - installSize: size on disk after install
   * - downloadSize: how many bytes are downloaded (but not necessarily stored)
   */
  async getVersionSize(versionId: string): Promise<GameVersionSize | null> {
    if (await this.gameVersionsSizesCache.has(versionId))
      return await this.gameVersionsSizesCache.get(versionId);
    try {
      const { downloadSize, installSize } =
        await createDownloadManifestDetails(versionId);
      const result = {
        downloadSize,
        installSize,
        versionId,
      } satisfies GameVersionSize;
      await this.gameVersionsSizesCache.set(versionId, result);
      return result;
    } catch {
      return null;
    }
  }

  /***
   * Get the size of the game on disk
   */
  async getVersionDiskSize(versionId: string): Promise<number | null> {
    const version = await prisma.gameVersion.findUnique({
      where: {
        versionId,
      },
      select: {
        dropletManifest: true,
      },
    });
    if (!version) return null;
    return castManifest(version.dropletManifest).size;
  }

  /**
   * Calculate the total disk usage of a game
   * @param gameId Game ID to calculate
   * @returns Total **disk** size of the game
   */
  async getGameDiskSize(gameId: string): Promise<number> {
    const versions = await prisma.gameVersion.findMany({
      where: { gameId },
      select: {
        versionId: true,
      },
    });
    const sizes = await Promise.all(
      versions.map((version) => this.getVersionDiskSize(version.versionId)),
    );
    return sum(sizes.filter((v) => v !== null));
  }

  async getGameBreakdown(gameId: string): Promise<GameSizeBreakdown | null> {
    const versions = await prisma.gameVersion.findMany({
      where: { gameId },
      orderBy: { versionIndex: "desc" },
      select: { versionId: true, displayName: true, versionPath: true },
    });
    if (!versions) return null;

    const breakdownKey = `${gameId} ${versions.map((v) => v.versionId).join(" ")}`;

    if (await this.gameBreakdownCache.has(breakdownKey))
      return (await this.gameBreakdownCache.get(breakdownKey))!;

    let diskSize = 0;
    const versionInformation = [];
    for (const version of versions) {
      const size = (await this.getVersionSize(version.versionId))!;
      const vDiskSize = (await this.getVersionDiskSize(version.versionId))!;
      diskSize += vDiskSize;
      versionInformation.push({
        ...size,
        diskSize: vDiskSize,
        name: (version.displayName ?? version.versionPath)!,
      });
    }
    const result = {
      diskSize,
      versions: versionInformation,
    };
    await this.gameBreakdownCache.set(breakdownKey, result);
    return result;
  }
}

export const gameSizeManager = new GameSizeManager();
export default gameSizeManager;
