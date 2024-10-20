import { GameVersion } from "@prisma/client";
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
        Object.entries(rootManifest.manifest).map(([key, value]) => [
          key,
          Object.assign({}, value, { versionName: rootManifest.versionName }),
        ])
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

    for (let i = 0; true; i++) {
      const currentVersion = (
        await prisma.gameVersion.findMany({
          where: {
            gameId: gameId,
            versionName: versionName,
          },
          orderBy: {
            versionIndex: "desc", // Get highest priority first
          },
          skip: i,
          take: 1,
        })
      )[0];
      if(!currentVersion) return undefined;
      versions.push(currentVersion);
      if (!currentVersion.delta) break;
    }

    const leastToMost = versions.reverse();
    const metadata: DropManifestMetadata[] = leastToMost.map((e) => {
      return {
        manifest: e.dropletManifest as DropManifest,
        versionName: e.versionName,
      };
    });

    const manifest = ManifestGenerator.generateManifestFromMetadata(
      metadata[0],
      ...metadata.slice(1)
    );

    return manifest;
  }
}

export const manifestGenerator = new ManifestGenerator();
export default manifestGenerator;
