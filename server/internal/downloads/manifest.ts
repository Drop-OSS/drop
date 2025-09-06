import prisma from "../db/database";

export type DropChunk = {
  permissions: number;
  ids: string[];
  checksums: string[];
  lengths: number[];
};

export type DropManifest = {
  [key: string]: DropChunk;
};

export type DropManifestMetadata = {
  manifest: DropManifest;
  versionId: string;
};

export type DropGeneratedManifest = DropManifest & {
  [key: string]: { versionId: string };
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
            Object.assign({}, value, { versionId: rootManifest.versionId }),
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
          versionId: version.versionId,
        });
      }
    }

    return manifest;
  }

  // Local function because eventual caching
  async generateManifest(versionId: string) {
    const versions = [];

    const baseVersion = await prisma.gameVersion.findUnique({
      where: {
        versionId,
        version: {
          gameId: {
            not: null,
          },
        },
      },
      include: {
        platform: true,
        version: {
          select: {
            gameId: true,
            dropletManifest: true,
          },
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
            version: {
              gameId: baseVersion.version.gameId!,
            },
            platform: {
              id: baseVersion.platform.id,
            },
            versionIndex: i,
          },
          include: {
            version: {
              select: {
                dropletManifest: true,
              },
            },
          },
        });
        if (!currentVersion) return undefined;
        versions.push(currentVersion);
        if (!currentVersion?.delta) break;
      }
    }
    versions.reverse();
    const metadata: DropManifestMetadata[] = versions.map((gameVersion) => {
      return {
        manifest: JSON.parse(
          gameVersion.version.dropletManifest?.toString() ?? "{}",
        ) as DropManifest,
        versionId: gameVersion.versionId,
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
