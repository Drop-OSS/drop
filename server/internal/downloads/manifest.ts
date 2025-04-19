import type { GameVersion } from "@prisma/client";
import prisma from "../db/database";

export type DropChunk = {
  permissions: number;
  ids: string[];
  checksums: string[];
  lengths: string[];
};

export type DropManifest = {
  [key: string]: DropChunk;
};

export type DropManifestMetadata = {
  manifest: DropManifest;
  versionName: string;
};

export type DropGeneratedManifest = DropManifest & {
  [key: string]: { versionName: string };
};

class ManifestGenerator {
  private static generateManifestFromMetadata(
    rootManifest: DropManifestMetadata,
    ...overlays: DropManifestMetadata[]
  ): DropGeneratedManifest {
    if (overlays.length == 0) {
      return Object.fromEntries(
        Object.entries(rootManifest.manifest).map(([key, value]) => {
          return [
            key,
            Object.assign({}, value, { versionName: rootManifest.versionName }),
          ];
        }),
      );
    }

    // Recurse in verse order through versions, skipping files that already exist.
    const versions = [...overlays.reverse(), rootManifest];
    const manifest: DropGeneratedManifest = {};
    for (const version of versions) {
      for (const [filename, chunk] of Object.entries(version.manifest)) {
        if (manifest[filename]) continue;
        manifest[filename] = Object.assign({}, chunk, {
          versionName: version.versionName,
        });
      }
    }

    return manifest;
  }

  // Local function because eventual caching
  async generateManifest(gameId: string, versionName: string) {
    const versions: GameVersion[] = [];

    const baseVersion = await prisma.gameVersion.findUnique({
      where: {
        gameId_versionName: {
          gameId: gameId,
          versionName: versionName,
        },
      },
    });
    if (!baseVersion) return undefined;
    versions.push(baseVersion);

    // Collect other versions if this is a delta
    if (baseVersion.delta) {
      // Start at the same index minus one, and keep grabbing them
      // until we run out or we hit something that isn't a delta
      // eslint-disable-next-line no-constant-condition
      for (let i = baseVersion.versionIndex - 1; true; i--) {
        const currentVersion = await prisma.gameVersion.findFirst({
          where: {
            gameId: gameId,
            versionIndex: i,
            platform: baseVersion.platform,
          },
        });
        if (!currentVersion) return undefined;
        versions.push(currentVersion);
        if (!currentVersion.delta) break;
      }
    }
    const leastToMost = versions.reverse();
    const metadata: DropManifestMetadata[] = leastToMost.map((e) => {
      return {
        manifest: JSON.parse(
          e.dropletManifest?.toString() ?? "{}",
        ) as DropManifest,
        versionName: e.versionName,
      };
    });

    const manifest = ManifestGenerator.generateManifestFromMetadata(
      metadata[0],
      ...metadata.slice(1),
    );

    return manifest;
  }
}

export const manifestGenerator = new ManifestGenerator();
export default manifestGenerator;
