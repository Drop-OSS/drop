import { createError } from "h3";
import { createHash } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { gunzipSync, inflateSync, inflateRawSync } from "node:zlib";
import * as zlib from "node:zlib";
import {
  buildUbisoftDownloadPlan,
  parseUbisoftManifest,
  sliceCdnPathCandidates,
  type UbisoftPlanFile,
} from "./manifest";
import {
  UbisoftAcquisitionClient,
  type UbisoftDownloadSession,
  type UbisoftOwnedGame,
} from "./demux/acquisition";

/**
 * Acquires a Ubisoft Connect title by assembling its slice-based depot
 * format directly into a Drop library game tree - the counterpart of the
 * GOG content-system streamer. No Ubisoft Connect, no installer.
 *
 * Layout ground truth (live-verified Nov 2026, Anno 2070 pid 22): the game
 * is a set of files cut into content-addressed slices on the CDN
 * (`slices_v3/<char>/<SHA1>`). Slice bodies are individually compressed -
 * zstd for current titles, zlib for legacy ones, raw for others - detected
 * per slice by magic. The content SHA-1 verifies the *decompressed* body;
 * the download SHA-1 (when distinct) names the CDN object. Signed URLs
 * expire (ttl 3600s observed), so a 403 re-mints and resumes; the fetch
 * never restarts the file.
 *
 * Every slice is fetched exactly once even when several files share it
 * (dedupe patches), and written at its declared offset through a sparse
 * preallocated file.
 */

/** Slices per UrlReq; oversized batches drew server timeouts when probed. */
const URL_BATCH = 200;
const SLICE_CONCURRENCY = 8;
const SLICE_TIMEOUT_MS = 120_000;
/** Directories tried for a slice when the computed one 404s (candidates first). */
const MAX_DIRECTORY_CANDIDATES = 4;

/** Node's zstd support is newer than the shared type floor; probe it. */
const zstdDecompressSync = (
  zlib as unknown as Record<string, ((b: Buffer) => Buffer) | undefined>
).zstdDecompressSync;

export interface UbisoftLaunchOption {
  name: string;
  /** Path relative to the install directory, as the config ships it. */
  executable: string;
  /** CLI arguments from the install configuration (may be empty). */
  arguments: string[];
}

export interface StreamUbisoftGameOptions {
  productId: number;
  /** Manifest SHA-1 to acquire; the ownership service's latest when omitted. */
  manifestSha1?: string;
  language?: string;
  accessToken: string;
  /**
   * The library game directory (`<libraryBaseDir>/<libraryPath>`). A fresh
   * per-manifest subdirectory inside it holds the assembled tree.
   */
  gameDir: string;
  signal?: AbortSignal;
  onProgress?: (update: {
    phase: string;
    progress: number;
    currentItem?: string;
  }) => void;
}

export interface UbisoftAcquisitionResult {
  /** Lower-case manifest SHA-1; names the imported version directory. */
  versionName: string;
  versionDir: string;
  title: string | null;
  fileCount: number;
  totalBytes: number;
  /** Relative executables from the install configuration. */
  launches: UbisoftLaunchOption[];
}

/** Decompress one slice body by its magic; unrecognised bytes pass through. */
export function decompressSliceBody(body: Buffer): Buffer {
  if (body.length >= 4 && body.readUInt32LE(0) === 0xfd2fb528)
    return zstdOrThrow(body);
  if (body.length >= 2 && body[0] === 0x28 && body[1] === 0xb5)
    return zstdOrThrow(body); // zstd skippable-frame prefix
  if (body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b)
    return gunzipSync(body);
  if (body.length >= 2 && body[0] === 0x78) {
    // Magic alone is only a heuristic - the SHA-1 gate in acquireSlice is
    // the real check, so an undecodable 0x78 opener passes through raw.
    try {
      return inflateSync(body);
    } catch {
      try {
        return inflateRawSync(body);
      } catch {
        return body;
      }
    }
  }
  return body;
}

function zstdOrThrow(body: Buffer): Buffer {
  if (!zstdDecompressSync) {
    throw createError({
      statusCode: 500,
      statusMessage: "This runtime cannot decompress zstd slices",
    });
  }
  return zstdDecompressSync(body);
}

function abortError(): never {
  throw createError({
    statusCode: 499,
    statusMessage: "Ubisoft game acquisition aborted",
  });
}

function isAbortLike(error: unknown, signal: AbortSignal | undefined): boolean {
  if (signal?.aborted) return true;
  const name = (error as { name?: string } | null)?.name ?? "";
  return name === "AbortError" || name === "TimeoutError";
}

/** One unique CDN slice object and every place its bytes belong. */
type SliceTarget = {
  /** SHA-1 the decompressed body must hash to. */
  verifySha1: string;
  /** Decompressed length the manifest declares. */
  size: number;
  writes: { file: UbisoftPlanFile; offset: number }[];
};

/**
 * Signed-URL pool. The normal path mints in UrlReq batches of URL_BATCH
 * unique paths ( oversized batches drew server timeouts when probed);
 * retries mint single URLs, always fresh - a URL that already failed is
 * consumed and never handed out twice.
 */
class SliceUrlPool {
  private urls = new Map<string, string>();

  constructor(private readonly session: UbisoftDownloadSession) {}

  async prime(paths: string[]): Promise<void> {
    for (let start = 0; start < paths.length; start += URL_BATCH) {
      const chunk = paths.slice(start, start + URL_BATCH);
      try {
        const minted = await this.session.mintUrls(chunk);
        chunk.forEach((path, index) => this.urls.set(path, minted[index]));
      } catch {
        // A refused batch costs nothing: acquisitions fall back to
        // single-path mints, just slower.
      }
    }
  }

  take(path: string): Promise<string> | string {
    const cached = this.urls.get(path);
    if (cached !== undefined) {
      this.urls.delete(path);
      return cached;
    }
    return this.session.mintUrls([path]).then(([url]) => url);
  }
}

/**
 * Fetch one slice with the launcher's own fallback ladder: pooled signed URL
 * for the computed directory first; HTTP 403 re-mints the same path (URLs
 * age); 404 walks the candidate directories. SHA-1-verifies the body.
 */
async function acquireSlice(
  pool: SliceUrlPool,
  cdnPath: string,
  target: SliceTarget,
  signal: AbortSignal | undefined,
): Promise<Buffer> {
  const candidates = sliceCdnPathCandidates(cdnPath).slice(
    0,
    MAX_DIRECTORY_CANDIDATES,
  );
  let lastStatus = "no attempt";
  for (const candidate of candidates) {
    // A 403 means the URL, not the path, went stale: re-mint and retry once.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) abortError();
      const url = await pool.take(candidate);
      let response: Response;
      try {
        response = await fetch(url, {
          signal: signal ?? AbortSignal.timeout(SLICE_TIMEOUT_MS),
        });
      } catch (error) {
        if (isAbortLike(error, signal)) abortError();
        lastStatus = "connection failed";
        break; // same URL will not improve; try the next directory
      }
      if (response.status === 403) {
        lastStatus = "HTTP 403 (signed URL expired)";
        continue; // re-mint
      }
      if (response.status === 404) {
        lastStatus = "HTTP 404";
        break; // wrong directory: walk to the next candidate
      }
      if (!response.ok) {
        throw createError({
          statusCode: 502,
          statusMessage: `Ubisoft CDN returned HTTP ${response.status} for slice ${candidate}`,
        });
      }
      const body = decompressSliceBody(
        Buffer.from(await response.arrayBuffer()),
      );
      const digest = createHash("sha1")
        .update(body)
        .digest("hex")
        .toUpperCase();
      if (digest !== target.verifySha1) {
        throw createError({
          statusCode: 502,
          statusMessage: `Ubisoft slice ${candidate} failed SHA-1 verification (${digest})`,
        });
      }
      if (body.length !== target.size) {
        throw createError({
          statusCode: 502,
          statusMessage: `Ubisoft slice ${candidate} is ${body.length} bytes, manifest declares ${target.size}`,
        });
      }
      return body;
    }
  }
  throw createError({
    statusCode: 502,
    statusMessage: `Ubisoft CDN would not serve slice ${cdnPath} (${lastStatus})`,
  });
}

/**
 * Fetch one full CDN object for the install manifest. Path shape
 * `manifests/<SHA>.manifest` is live-verified; the response carries the
 * 356-byte header parseUbisoftManifest expects.
 */
async function fetchManifestBytes(
  session: UbisoftDownloadSession,
  manifestSha1: string,
): Promise<Buffer> {
  const [url] = await session.mintUrls([`manifests/${manifestSha1}.manifest`]);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(SLICE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Ubisoft CDN returned HTTP ${response.status} for install manifest ${manifestSha1}`,
    });
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Acquires a Ubisoft Connect game by assembling its slices straight into the
 * Drop library layout `<gameDir>/<manifestSha>/<files>`; the ingest task
 * then performs the standard version import. The install configuration's
 * launch documents gate the download: a title whose config declares no
 * relative executable cannot be launched from disk and is refused first
 * (GOG's info-document gate, Ubisoft edition).
 */
export async function streamUbisoftGameToDepot(
  options: StreamUbisoftGameOptions,
): Promise<UbisoftAcquisitionResult> {
  const {
    productId,
    manifestSha1,
    language = "en-US",
    accessToken,
    gameDir,
    signal,
    onProgress,
  } = options;
  const report = (progress: number, phase: string, currentItem?: string) =>
    onProgress?.({ phase, progress, currentItem });

  report(1, "connecting");
  const client = await UbisoftAcquisitionClient.connect(accessToken);
  try {
    report(2, "ownership");
    const ownedGames = await client.listOwnedGames();
    const game: UbisoftOwnedGame | undefined = ownedGames.find(
      (entry) => entry.productId === productId,
    );
    if (!game) {
      throw createError({
        statusCode: 404,
        statusMessage: `Ubisoft ownership shows no product ${productId} for this account`,
      });
    }
    if (!game.owned) {
      throw createError({
        statusCode: 403,
        statusMessage: `Ubisoft product ${productId} is not owned by this account`,
      });
    }
    const manifest = (manifestSha1 ?? game.latestManifest ?? "")
      .trim()
      .toUpperCase();
    if (!/^[0-9A-F]{40}$/.test(manifest)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Ubisoft product ${productId} exposes no install manifest to acquire`,
      });
    }
    if (game.launches.length === 0) {
      throw createError({
        statusCode: 422,
        statusMessage: `Ubisoft product ${productId} declares no launchable game executable`,
      });
    }

    report(4, "download_credentials");
    const credentials = await client.getDownloadCredentials(productId);
    const session = await client.openDownloads(productId, credentials);

    report(6, "manifest");
    const blob = await fetchManifestBytes(session, manifest);
    const plan = buildUbisoftDownloadPlan(parseUbisoftManifest(blob), language);
    if (plan.files.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `Ubisoft manifest ${manifest} contains no acquirable files`,
      });
    }

    const versionName = manifest.toLowerCase();
    const versionDir = resolve(join(resolve(gameDir), versionName));
    await rm(versionDir, { recursive: true, force: true });
    await mkdir(versionDir, { recursive: true });

    // Unique-slice work list: shared slices (patch dedupe) download once,
    // land at every offset the manifest assigns them.
    const slices = new Map<string, SliceTarget>();
    for (const file of plan.files) {
      for (const slice of file.slices) {
        const existing = slices.get(slice.cdnPath);
        if (existing) {
          existing.writes.push({ file, offset: slice.offset });
          continue;
        }
        slices.set(slice.cdnPath, {
          verifySha1: slice.verifySha1,
          size: slice.size,
          writes: [{ file, offset: slice.offset }],
        });
      }
    }

    // Pre-create sparse files so writers only ever pwrite real bytes; files
    // without slices (empty placeholders) just need to exist on disk.
    const handles = new Map<string, Promise<FileHandle>>();
    const handleFor = (file: UbisoftPlanFile): Promise<FileHandle> => {
      let handle = handles.get(file.path);
      if (!handle) {
        handle = (async () => {
          const target = resolve(join(resolve(versionDir), file.path));
          await mkdir(dirname(target), { recursive: true });
          const opened = await open(target, "w");
          if (file.size > 0) await opened.truncate(file.size);
          return opened;
        })();
        handles.set(file.path, handle);
      }
      return handle;
    };

    report(8, "assembling_game_files", `${slices.size} slices`);
    for (const file of plan.files)
      if (file.slices.length === 0) await handleFor(file);
    const pool = new SliceUrlPool(session);
    await pool.prime([...slices.keys()]);
    const writtenBytes = new Map<string, number>();
    let doneSlices = 0;
    const queue = [...slices.entries()];
    let failure: unknown = null;
    const workers = Array.from({ length: SLICE_CONCURRENCY }, async () => {
      for (;;) {
        if (failure) return;
        const next = queue.shift();
        if (!next) return;
        if (signal?.aborted) {
          failure ??= createError({
            statusCode: 499,
            statusMessage: "Ubisoft game acquisition aborted",
          });
          return;
        }
        const [cdnPath, target] = next;
        try {
          const body = await acquireSlice(pool, cdnPath, target, signal);
          for (const write of target.writes) {
            const handle = await handleFor(write.file);
            await handle.write(body, write.offset);
            writtenBytes.set(
              write.file.path,
              (writtenBytes.get(write.file.path) ?? 0) + body.length,
            );
          }
          doneSlices += 1;
          report(
            8 + Math.floor((doneSlices / Math.max(1, slices.size)) * 70),
            "assembling_game_files",
            `${doneSlices}/${slices.size} slices`,
          );
        } catch (error) {
          failure ??= error;
          return;
        }
      }
    });
    try {
      await Promise.all(workers);
    } finally {
      await Promise.all(
        [...handles.values()].map(async (handle) =>
          (await handle).close().catch(() => {}),
        ),
      );
    }
    if (failure) throw failure;

    for (const file of plan.files) {
      const written = writtenBytes.get(file.path) ?? 0;
      if (written !== file.size) {
        throw createError({
          statusCode: 502,
          statusMessage: `Ubisoft file ${file.path}: wrote ${written} bytes, manifest declares ${file.size}`,
        });
      }
    }

    report(79, "assembled");
    return {
      versionName,
      versionDir,
      title: game.title,
      fileCount: plan.files.length,
      totalBytes: plan.totalBytes,
      launches: game.launches,
    };
  } finally {
    client.destroy();
  }
}
