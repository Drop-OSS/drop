import { createError } from "h3";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { stageAdapterRelease, type AdapterFile } from "../adapter/contract";
import {
  buildGogChunkUrl,
  getGogBuildMeta,
  getGogDepotManifest,
  getGogProductBuilds,
  getGogSecureLinks,
  gogGalaxyPath,
  type GogFileChunk,
  type GogManifestFile,
  type GogMetaDepot,
  type GogSecureEndpoint,
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
  /** Product title recorded in the release meta; the id is the fallback. */
  gameTitle?: string;
  /** Selects a specific build; the newest returned build is used when omitted. */
  buildId?: string;
  generation?: number;
  os?: string;
  /** Depot language selector; "*" depots always match. Default "en-US". */
  language?: string;
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
 * GOG v2 depot chunks live on the secure_link-signed endpoints (the token is
 * in the URL; the request itself carries no Authorization header), stored
 * zlib-compressed with two declared digests: `compressedMd5` over the wire
 * bytes and `md5` over the inflated ones. Both are verified - a mismatch
 * fails the release rather than publishing suspect bytes. Endpoint rotation
 * mirrors the launcher: retry against the next returned endpoint.
 */
async function acquireGogChunk(
  endpoints: GogSecureEndpoint[],
  file: GogManifestFile,
  chunk: GogFileChunk,
  signal: AbortSignal | undefined,
): Promise<Buffer> {
  const key = chunk.compressedMd5 ?? chunk.md5;
  if (!key) {
    throw createError({
      statusCode: 502,
      statusMessage: `GOG chunk without an MD5 in ${file.path}`,
    });
  }

  const galaxy = gogGalaxyPath(key);
  let lastError = "no attempt";
  for (let attempt = 0; attempt < 5; attempt++) {
    const endpoint = endpoints[Math.min(attempt, endpoints.length - 1)];
    let response: Response;
    try {
      response = await fetch(buildGogChunkUrl(endpoint, galaxy), {
        headers: { accept: "application/octet-stream" },
        signal: signal ?? AbortSignal.timeout(120_000),
      });
    } catch {
      lastError = "connection failed";
      continue;
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw createError({
          statusCode: 502,
          statusMessage: `GOG rejected the download secure link for chunk ${key} (${response.status}) - requeue the task to sign a fresh one`,
        });
      }
      lastError = `HTTP ${response.status}`;
      continue;
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (md5Hex(body) !== key.toLowerCase()) {
      lastError = "compressed MD5 mismatch";
      continue;
    }

    let bytes: Buffer;
    try {
      bytes = inflateSync(body);
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: `GOG chunk ${key} for ${file.path} is not a readable zlib stream`,
      });
    }
    if (chunk.md5 && md5Hex(bytes) !== chunk.md5.toLowerCase()) {
      throw createError({
        statusCode: 502,
        statusMessage: `GOG chunk MD5 mismatch for ${file.path} (${key})`,
      });
    }
    return bytes;
  }
  throw createError({
    statusCode: 502,
    statusMessage: `Failed to fetch GOG chunk ${key} for ${file.path}: ${lastError}`,
  });
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
    gameTitle,
    buildId,
    generation,
    os,
    language = "en-US",
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

    // Nov 2026 live ground truth: the build item's `link` document carries
    // the depots; the former build-list `depots[]` and the /manifests/<hash>
    // route no longer exist.
    const meta = await getGogBuildMeta(build.link, { accessToken });
    const baseProductId = meta.baseProductId ?? productId;
    const wantedDepots = meta.depots.filter((depot: GogMetaDepot) => {
      if (!depot.manifest) return false;
      // Depots belonging to other products are DLCs; their entitlement is
      // separate and out of scope for base-game acquisition.
      if (depot.productId && depot.productId !== baseProductId) return false;
      const languages = depot.languages ?? [];
      if (
        languages.length > 0 &&
        !languages.includes("*") &&
        !languages.includes(language)
      )
        return false;
      const bitness = depot.osBitness ?? [];
      // The server acquires 64-bit content; 32-bit-only depots are skipped.
      return bitness.length === 0 || bitness.includes("64");
    });
    if (wantedDepots.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `GOG build ${build.buildId} exposes no depot manifest for ${os ?? "windows"}/${language}/x64`,
      });
    }

    // Multiple depots (content + small config overlays) apply in order;
    // a later depot overwriting an earlier path is how GOG ships updates.
    const filesByPath = new Map<string, GogManifestFile>();
    for (const depot of wantedDepots) {
      const depotManifest = await getGogDepotManifest(depot.manifest);
      for (const file of depotManifest.files) {
        filesByPath.set(file.path, file);
      }
    }

    const downloadable = [...filesByPath.values()].filter(
      (file) => file.chunks.length > 0,
    );
    if (downloadable.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage:
          "No files found in the GOG depot manifests for this build",
      });
    }

    const secureEndpoints = await getGogSecureLinks(productId, {
      accessToken,
    });

    const files: AdapterFile[] = downloadable.map((file) => ({
      fileId: file.path,
      path: file.path,
      size: file.size,
    }));

    await report("RUNNING", 6, "streaming_game_files", {
      currentItem: files[0]?.path,
    });

    const { manifestPath } = await stageAdapterRelease({
      gameTitle: gameTitle ?? productId,
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
            yield await acquireGogChunk(secureEndpoints, source, chunk, signal);
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
