import { createError } from "h3";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { inflateRawSync } from "node:zlib";
import { stageAdapterRelease, type AdapterFile } from "../adapter/contract";
import {
  getGogChunkUrl,
  getGogDepotManifest,
  getGogProductBuilds,
  type GogManifestFile,
} from "./cdn";

export type StreamJobStatus = "RUNNING" | "COMPLETED" | "FAILED";

export interface StreamJobStore {
  update(input: {
    id: string;
    status: StreamJobStatus;
    progress?: number;
    phase?: string;
    manifestPath?: string;
    error?: string;
  }): Promise<unknown>;
}

export interface StreamGogGameOptions {
  jobId: string;
  productId: string;
  /** Selects a specific build; the newest returned build is used when omitted. */
  buildId?: string;
  generation?: number;
  os?: string;
  accessToken: string;
  /** Depot CAS root; chunk objects and the release manifest live under it. */
  depotRoot: string;
  store?: StreamJobStore;
  onProgress?: (progress: {
    phase: string;
    progress: number;
    currentItem?: string;
  }) => void;
}

const md5Hex = (bytes: Buffer) => createHash("md5").update(bytes).digest("hex");

/**
 * Fetch one content-system chunk and return its *uncompressed* bytes.
 *
 * GOG serves depot chunks deflate-compressed and declares both sizes plus an MD5
 * for each form, so the payload is inflated when the sizes differ and the
 * resulting bytes are checked against the manifest MD5. A mismatch means our
 * decode assumption is wrong for this chunk, and the release is not published.
 */
async function acquireGogChunk(
  file: GogManifestFile,
  chunk: NonNullable<GogManifestFile["chunks"]>[number],
  signal: AbortSignal | undefined,
): Promise<Buffer> {
  const key = chunk.compressedMd5 ?? chunk.md5;
  if (!key) {
    throw createError({
      statusCode: 502,
      statusMessage: `GOG chunk without an MD5 in ${file.path}`,
    });
  }

  const response = await fetch(getGogChunkUrl(key), {
    headers: { accept: "application/octet-stream" },
    signal: signal ?? AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Failed to fetch GOG chunk ${key} for ${file.path} (${response.status})`,
    });
  }

  let bytes = Buffer.from(await response.arrayBuffer());

  const isCompressed =
    typeof chunk.compressedSize === "number" &&
    chunk.compressedSize !== chunk.size;
  if (isCompressed) {
    try {
      bytes = inflateRawSync(bytes);
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: `Failed to inflate GOG chunk ${key} for ${file.path}`,
      });
    }
  }

  if (chunk.md5 && md5Hex(bytes) !== chunk.md5.toLowerCase()) {
    throw createError({
      statusCode: 502,
      statusMessage: `GOG chunk MD5 mismatch for ${file.path} (${key})`,
    });
  }
  return bytes;
}

/**
 * Streams unpacked game files directly from GOG's content-system CDN into the
 * depot CAS and publishes a DropletManifest, bypassing installer extraction.
 *
 * Re-framing into depot chunks, whole-file digest computation and atomic
 * publication are handled by the shared adapter contract; this module only knows
 * how to resolve a GOG build and address its chunks.
 */
export async function streamGogGameToDepot(
  options: StreamGogGameOptions,
): Promise<string> {
  const {
    jobId,
    productId,
    buildId,
    generation,
    os,
    accessToken,
    depotRoot,
    store,
    onProgress,
  } = options;

  const report = async (
    status: StreamJobStatus,
    progress: number,
    phase: string,
    extra: Record<string, unknown> = {},
  ) => {
    if (store) {
      await store.update({ id: jobId, status, progress, phase, ...extra });
    }
    onProgress?.({
      phase,
      progress,
      currentItem: extra.currentItem as string | undefined,
    });
  };

  const depot = resolve(depotRoot);
  const objectsDir = resolve(depot, "objects");
  const manifestsDir = resolve(depot, "manifests");
  await mkdir(objectsDir, { recursive: true });
  await mkdir(manifestsDir, { recursive: true });

  try {
    await report("RUNNING", 2, "manifest_discovery");

    const builds = await getGogProductBuilds(
      productId,
      { accessToken },
      { generation, os },
    );
    const build = buildId
      ? builds.find((b) => b.buildId === buildId)
      : builds[0];
    if (!build) {
      throw createError({
        statusCode: 404,
        statusMessage: `No GOG build${buildId ? ` ${buildId}` : ""} for product ${productId}`,
      });
    }

    const depotManifest = build.depots?.find((d) => d.manifest);
    if (!depotManifest?.manifest) {
      throw createError({
        statusCode: 404,
        statusMessage: `GOG build ${build.buildId} exposes no depot manifest`,
      });
    }

    const manifest = await getGogDepotManifest(depotManifest.manifest, {
      accessToken,
    });
    const downloadable = manifest.files.filter(
      (file) => (file.chunks?.length ?? 0) > 0,
    );
    if (downloadable.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `No files found in GOG depot manifest ${depotManifest.manifest}`,
      });
    }

    const files: AdapterFile[] = [];
    const filesByPath = new Map<string, GogManifestFile>();
    for (const file of downloadable) {
      if (filesByPath.has(file.path)) {
        throw createError({
          statusCode: 502,
          statusMessage: `Duplicate GOG file path: ${file.path}`,
        });
      }
      filesByPath.set(file.path, file);
      files.push({ fileId: file.path, path: file.path, size: file.size });
    }

    await report("RUNNING", 6, "streaming_game_files", {
      currentItem: files[0]?.path,
    });

    const { manifestPath } = await stageAdapterRelease({
      gameTitle: productId,
      appVersion: build.versionName,
      files,
      objectsDir,
      manifestsDir,
      onProgress: (progress) => {
        // 6%..96% across the acquisition phase; the contract owns the publish step.
        const within = progress.totalFiles
          ? progress.fileIndex / progress.totalFiles
          : 1;
        void report(
          "RUNNING",
          Math.min(96, 6 + Math.floor(within * 90)),
          "streaming_game_files",
          {
            currentItem: progress.currentFile,
          },
        );
      },
      acquire: async (file, signal) => {
        const entry: GogManifestFile | undefined = filesByPath.get(file.fileId);
        if (!entry) {
          throw createError({
            statusCode: 500,
            statusMessage: `No GOG manifest entry for ${file.fileId}`,
          });
        }
        const source: GogManifestFile = entry;
        const parts = source.chunks ?? [];
        async function* chunks(): AsyncGenerator<Buffer> {
          for (const chunk of parts) {
            yield await acquireGogChunk(source, chunk, signal);
          }
        }
        return chunks();
      },
    });

    await report("COMPLETED", 100, "published", { manifestPath });
    return manifestPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await report("FAILED", 0, "failed", { error: message });
    throw error;
  }
}
