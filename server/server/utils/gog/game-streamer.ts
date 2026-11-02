import { createError } from "h3";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { inflateSync } from "node:zlib";
import { forEachPooled } from "../depot/pool";
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

/** GOG acquisition fetches this many files at once (chunks stay serial per file). */
const GOG_FILE_CONCURRENCY = 4;

export interface StreamGogGameOptions {
  productId: string;
  /** Product title recorded with the acquisition; the id is the fallback. */
  gameTitle?: string;
  /** Selects a specific build; the newest returned build is used when omitted. */
  buildId?: string;
  generation?: number;
  os?: string;
  /** Depot language selector; "*" depots always match. Default "en-US". */
  language?: string;
  accessToken: string;
  /**
   * The library game directory (`<libraryBaseDir>/<libraryPath>`). A fresh
   * per-build subdirectory is created inside it and holds the assembled
   * game tree - exactly the layout Drop's Filesystem library imports.
   */
  gameDir: string;
  onProgress?: (update: {
    phase: string;
    progress: number;
    currentItem?: string;
  }) => void;
}

export interface GogLaunchOption {
  name: string;
  /** Path relative to the install directory, as GOG ships it. */
  executable: string;
  arguments: string[];
}

export interface GogAcquisitionResult {
  /** Sanitized build version; names the imported version directory. */
  versionName: string;
  versionDir: string;
  installDirectory?: string;
  fileCount: number;
  totalBytes: number;
  /** Windows executables declared `Game` in the GOG game info. */
  launches: GogLaunchOption[];
}

const md5Hex = (bytes: Buffer) => createHash("md5").update(bytes).digest("hex");

/** Reject anything that could escape the version directory. */
function safeRelativePath(path: string): string {
  const clean = path.replace(/^\/+/, "");
  if (
    clean.length === 0 ||
    clean.includes(":") ||
    clean.startsWith(sep) ||
    clean.split(/[\\/]/).some((seg) => seg === "..")
  ) {
    throw createError({
      statusCode: 502,
      statusMessage: `GOG depot contains an unsafe file path: ${path}`,
    });
  }
  return clean;
}

/**
 * Fetch one content-system chunk and return its *uncompressed* bytes.
 *
 * GOG v2 depot chunks live on the secure_link-signed endpoints (the token is
 * in the URL; the request itself carries no Authorization header), stored
 * zlib-compressed with two declared digests: `compressedMd5` over the wire
 * bytes and `md5` over the inflated ones. Both are verified - a mismatch
 * fails the acquisition rather than writing suspect bytes. Endpoint rotation
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

/** Concatenate every chunk of a manifest file into memory (small files only). */
async function acquireWholeFile(
  endpoints: GogSecureEndpoint[],
  file: GogManifestFile,
  signal: AbortSignal | undefined,
): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (const chunk of file.chunks) {
    parts.push(await acquireGogChunk(endpoints, file, chunk, signal));
  }
  return Buffer.concat(parts);
}

type GogInfoExecutable = {
  name?: string;
  path?: string;
  type?: string;
  arguments?: string | string[];
};

type GogPlayTask = {
  name?: string;
  path?: string;
  category?: string;
  type?: string;
  arguments?: string | string[];
};

const toArgs = (args: string | string[] | undefined): string[] =>
  Array.isArray(args) ? args : args ? [args] : [];

/**
 * Parse GOG's game info document for launchable executables. Two live-
 * verified schemas exist: the classic Galaxy `goggame-<id>.info.json` with
 * `executables[]` (`type: "Game"`, plateau-era nests them), and the newer
 * content-system `goggame-<id>.info` (no extension) whose `playTasks[]`
 * entries mark launchers with `category: "game"` and `type: "FileTask"`.
 */
export function parseGogInfo(json: string): {
  installDirectory?: string;
  launches: GogLaunchOption[];
} {
  let doc: {
    installDirectory?: string;
    executables?: GogInfoExecutable[];
    plateau?: { executables?: GogInfoExecutable[] };
    playTasks?: GogPlayTask[];
  };
  try {
    doc = JSON.parse(json);
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "The GOG game info document is not readable JSON",
    });
  }
  const declared: GogInfoExecutable[] = [
    ...(doc.executables ?? []),
    ...(doc.plateau?.executables ?? []),
    ...(doc.playTasks ?? [])
      .filter((task) => task.category === "game" && task.path)
      .map((task) => ({
        name: task.name,
        path: task.path,
        type: "Game",
        arguments: task.arguments,
      })),
  ];
  const launches: GogLaunchOption[] = [];
  for (const executable of declared) {
    if (executable.type !== "Game" || !executable.path) continue;
    launches.push({
      name: executable.name || "Play",
      executable: executable.path.replace(/\\/g, "/").replace(/^\/+/, ""),
      arguments: toArgs(executable.arguments),
    });
  }
  return { installDirectory: doc.installDirectory, launches };
}

/**
 * Acquires a GOG game by streaming its content-system depot chunks directly
 * into an assembled game tree under the Drop library directory - no
 * installer extraction, no intermediate archive. The tree layout matches
 * what Drop's Filesystem library and torrential droplet import expect:
 * `<gameDir>/<versionName>/<files>`. The caller (the ingest task) then
 * runs the standard version import to make the game a library game.
 *
 * The game info document (`goggame-<id>.info.json` for Galaxy-era builds,
 * `goggame-<id>.info` for content-system builds) is fetched before the bulk
 * download and must declare at least one launchable game executable: without
 * a launch command the standard importer would refuse the version anyway.
 */
export async function streamGogGameToDepot(
  options: StreamGogGameOptions,
): Promise<GogAcquisitionResult> {
  const {
    productId,
    buildId,
    generation,
    os,
    language = "en-US",
    accessToken,
    gameDir,
    onProgress,
  } = options;

  const report = (progress: number, phase: string, currentItem?: string) =>
    onProgress?.({ phase, progress, currentItem });

  report(2, "manifest_discovery");
  const builds = await getGogProductBuilds(
    productId,
    { accessToken },
    {
      generation,
      os,
    },
  );
  // Newest-first across *all* branches (gogdb.org ground truth); an
  // Experimental build published after the latest Master must not hijack
  // the acquisition. Fall back to the overall newest when nothing looks
  // like the stable branch.
  const stable = builds.filter((b) => !b.branch || b.branch === "Master");
  const build = buildId
    ? builds.find((b) => b.buildId === buildId)
    : (stable[0] ?? builds[0]);
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
  const wantedDepots: GogMetaDepot[] = meta.depots.filter((depot) => {
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
      filesByPath.set(safeRelativePath(file.path), file);
    }
  }

  const downloadable = [...filesByPath.values()].filter(
    (file) => file.chunks.length > 0,
  );
  if (downloadable.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "No files found in the GOG depot manifests for this build",
    });
  }

  const secureEndpoints = await getGogSecureLinks(productId, { accessToken });

  // Launch metadata first: a game nobody can launch is not worth 2 GB.
  report(4, "launch_metadata");
  const wantedInfoNames = [
    `goggame-${productId}.info.json`,
    `goggame-${productId}.info`,
  ];
  const infoPath = [...filesByPath.keys()].find((p) =>
    wantedInfoNames.includes((p.toLowerCase().split("/").pop() ?? "").trim()),
  );
  if (!infoPath) {
    throw createError({
      statusCode: 404,
      statusMessage: `GOG build ${build.buildId} ships no goggame-${productId}.info(.json) launch document`,
    });
  }
  const infoFile = filesByPath.get(infoPath)!;
  const { installDirectory, launches } = parseGogInfo(
    (await acquireWholeFile(secureEndpoints, infoFile, undefined)).toString(
      "utf8",
    ),
  );
  if (launches.length === 0) {
    throw createError({
      statusCode: 422,
      statusMessage: `goggame-${productId}.info declares no launchable game executable`,
    });
  }

  const versionName = (build.versionName || build.buildId).replace(
    /[^A-Za-z0-9._+-]/g,
    "_",
  );
  const versionDir = resolve(join(resolve(gameDir), versionName));
  await rm(versionDir, { recursive: true, force: true });
  await mkdir(versionDir, { recursive: true });

  const sorted = downloadable.sort((a, b) => a.path.localeCompare(b.path));
  let totalBytes = 0;
  let done = 0;
  // Files are independent here (one write stream each), unlike Ubisoft's
  // slice layout where several files share one CDN object; memory stays
  // bounded the same way - each worker holds exactly one chunk in flight.
  // Four concurrent files keeps the GOG CDN politely on one connection set.
  await forEachPooled(
    sorted,
    GOG_FILE_CONCURRENCY,
    undefined,
    "GOG game acquisition aborted",
    async (file) => {
      const target = join(versionDir, safeRelativePath(file.path));
      await mkdir(dirname(target), { recursive: true });
      let written = 0;
      const stream = createWriteStream(target);
      const source = Readable.from(
        (async function* () {
          for (const chunk of file.chunks) {
            const bytes = await acquireGogChunk(
              secureEndpoints,
              file,
              chunk,
              undefined,
            );
            written += bytes.length;
            yield bytes;
          }
        })(),
      );
      await pipeline(source, stream);
      if (file.size > 0 && written !== file.size) {
        throw createError({
          statusCode: 502,
          statusMessage: `GOG file ${file.path} size mismatch: wrote ${written}, manifest declared ${file.size}`,
        });
      }
      totalBytes += written;
      done += 1;
      report(
        Math.min(90, 5 + Math.floor((done / sorted.length) * 85)),
        "assembling_game_files",
        file.path,
      );
    },
  );

  report(92, "assembled");
  return {
    versionName,
    versionDir,
    ...(installDirectory ? { installDirectory } : {}),
    fileCount: sorted.length,
    totalBytes,
    launches,
  };
}
