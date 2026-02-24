import cacheHandler from "../../cache";
import prisma from "../../db/database";
import { castManifest, type DropletManifest } from "./utils";

export type DownloadManifestDetails = {
  /***
   * Version ID to manifest
   */
  manifests: { [key: string]: DropletManifest };
  /***
   * File name to version ID
   */
  fileList: { [key: string]: string };
  /// Size on disk after download
  installSize: number;
  /// Size of download
  downloadSize: number;
};

function convertMap<T>(map: Map<string, T>): { [key: string]: T } {
  return Object.fromEntries(map.entries().toArray());
}
const manifestCache =
  cacheHandler.createCache<DownloadManifestDetails>("manifestCache");

/**
 *
 * @param gameId Game ID
 * @param versionId Version ID
 */
export async function createDownloadManifestDetails(
  versionId: string,
  previous?: string,
  refresh = false,
): Promise<DownloadManifestDetails> {
  const manifestKey = `${versionId}${previous ? `-from-${previous}` : ""}`;
  if ((await manifestCache.has(manifestKey)) && !refresh)
    return (await manifestCache.get(manifestKey))!;
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
  while (mainVersion.delta) {
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

  let installSize = 0;
  let downloadSize = 0;

  const existingChunks = previous
    ? await createDownloadManifestDetails(previous)
    : undefined;

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
      Object.entries(manifest.chunks).filter(([_, chunkData]) => {
        //if(existingChunks && existingChunks.manifests[version.versionId]?.chunks?.[chunkId]) return false;
        let flag = false;
        chunkData.files.forEach((fileEntry) => {
          if (
            existingChunks &&
            existingChunks.fileList[fileEntry.filename] == version.versionId
          )
            return;
          if (fileNames[fileEntry.filename]) {
            flag = true;
            installSize += fileEntry.length;
          }
        });
        // If we have to download this chunk, add it's length
        if (flag) {
          downloadSize += chunkData.files
            .map((v) => v.length)
            .reduce((a, b) => a + b, 0);
        }
        return flag;
      }),
    );
    manifests.set(version.versionId, {
      ...manifest,
      chunks: filteredChunks,
    });
  }

  const result = {
    fileList: convertMap(fileList),
    manifests: convertMap(manifests),
    installSize,
    downloadSize,
  };
  await manifestCache.set(manifestKey, result);

  return result;
}
