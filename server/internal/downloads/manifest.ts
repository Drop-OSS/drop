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
  static generateManifest(
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
}

export const manifestGenerator = new ManifestGenerator();
export default manifestGenerator;
