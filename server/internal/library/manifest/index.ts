import prisma from "../../db/database";
import { castManifest, type DropletManifest } from "../manifest";

export type DownloadManifestDetails = {
  manifests: { [key: string]: DropletManifest };
  fileList: { [key: string]: string };
};

function convertMap<T>(map: Map<string, T>): { [key: string]: T } {
  return Object.fromEntries(map.entries().toArray());
}

/**
 *
 * @param gameId Game ID
 * @param versionId Version ID
 */
export async function createDownloadManifestDetails(
  versionId: string,
): Promise<DownloadManifestDetails> {
  const mainVersion = await prisma.gameVersion.findUnique({
    where: { versionId },
    select: {
      versionId: true,
      delta: true,
      versionIndex: true,
      fileList: true,
      negativeFileList: true,
      gameId: true,
      dropletManifest: true,
    },
  });
  if (!mainVersion)
    throw createError({ statusCode: 404, message: "Version not found" });

  const collectedVersions = [];
  let versionIndex = mainVersion.versionIndex;
  while (true) {
    const nextVersion = await prisma.gameVersion.findFirst({
      where: { gameId: mainVersion.gameId, versionIndex: { lt: versionIndex } },
      orderBy: {
        versionIndex: "desc",
      },
      select: {
        versionId: true,
        versionIndex: true,
        delta: true,
        fileList: true,
        negativeFileList: true,
        dropletManifest: true,
      },
    });
    if (!nextVersion)
      throw createError({
        statusCode: 500,
        message: "Delta version without version underneath it.",
      });

    versionIndex = nextVersion.versionIndex;
    collectedVersions.push(nextVersion);
    if (!nextVersion.delta) break;
  }

  collectedVersions.reverse();
  // Apply fileList in lowest priority to newest priority
  const versionOrder = [...collectedVersions, mainVersion];

  const fileList = new Map<string, string>();
  for (const version of versionOrder) {
    for (const file of version.fileList) {
      fileList.set(file, version.versionId);
    }
    for (const negFile of version.negativeFileList) {
      fileList.delete(negFile);
    }
  }

  // Now that we have our file list, filter the manifests
  const manifests = new Map<string, DropletManifest>();
  for (const version of versionOrder) {
    const files = fileList
      .entries()
      .filter(([, versionId]) => version.versionId === versionId)
      .toArray();
    if (files.length == 0) continue;
    const fileNames = Object.fromEntries(files);
    const manifest = castManifest(version.dropletManifest);
    const filteredChunks = Object.fromEntries(
      Object.entries(manifest.chunks).filter(([, chunkData]) =>
        chunkData.files.some((fileEntry) => !!fileNames[fileEntry.filename]),
      ),
    );
    manifests.set(version.versionId, {
      ...manifest,
      chunks: filteredChunks,
    });
  }

  return { fileList: convertMap(fileList), manifests: convertMap(manifests) };
}
