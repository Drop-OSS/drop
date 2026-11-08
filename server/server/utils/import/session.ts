import { randomUUID, createHash } from "node:crypto";
import { createError } from "h3";
import { mkdir, open, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DEPOT_CHUNK_SIZE, type DepotChunk } from "../depot/chunker";
import {
  createDropletManifest,
  writeDropletManifest,
  type DropletManifest,
} from "../depot/manifest";
import {
  casObjectPath,
  casManifestPath,
  isContentDigest,
} from "../depot/paths";
import { safeLogicalPath } from "../adapter/contract";

/**
 * Local-import sessions: the upload side of the content-addressed depot.
 *
 * The player's machine already holds the game files - the launcher put them
 * there - and the fixed-size SHA-256 chunking the store uses is fully
 * reproducible client-side. So a session lets a client declare a release
 * (paths, sizes, modes, per-chunk digests), learn which objects the depot
 * already has, ship only the rest, and commit what remains as a normal
 * `gamedepot-droplet` release through the same manifest machinery every
 * adapter publishes with.
 *
 * Trust follows the admin decision: imported bytes are unverified content.
 * Object digests are recomputed from arriving bytes and never trusted from
 * the client; the release identity (which game these files are) is a claim,
 * so publishing is admin-gated and the provenance record names the importer.
 */

/** Same limits `publishDirectoryToCas` puts on a server-side tree. */
const MAX_FILES = 200_000;
/** One file over 512 GiB is a bug or an attack, not a game. */
const MAX_FILE_SIZE = 512 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 ** 4;
const MAX_SESSIONS = 8;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface ImportChunkInput {
  size: number;
  sha256: string;
}

export interface ImportFileInput {
  path: string;
  size: number;
  /** Permission bits; imports carry the executable bit over, default 0o644. */
  mode?: number;
  sha256: string;
  /** Ordered fixed-size chunks; only the last may be short. */
  chunks: ImportChunkInput[];
}

export interface ImportOpenInput {
  gameTitle: string;
  appVersion?: string;
  /** Attach the release to an existing game instead of creating one. */
  gameId?: string;
  /** Free-text name of the player's machine, for provenance. */
  device?: string;
  /** Who is importing; filled from the authenticated session by the route. */
  importer?: string;
  /**
   * Whether the build starts on its own (true, the default: DRM-free,
   * anonymous-EOS, self-starting) or needs its store client running first
   * (false: legit EA/Rockstar/Ubisoft and mandatory-login titles). The
   * declarer knows what the folder holds; the depot just records it for
   * the launch path.
   */
  runsStandalone?: boolean;
  files: ImportFileInput[];
}

export interface ImportSessionFile {
  path: string;
  size: number;
  mode: number;
  sha256: string;
  chunks: DepotChunk[];
}

export type ImportSessionStatus = "uploading" | "committed" | "cancelled";

export interface ImportSession {
  id: string;
  gameTitle: string;
  appVersion: string | null;
  gameId: string | null;
  device: string | null;
  importer: string | null;
  /** Declared at open: see `ImportOpenInput.runsStandalone`. */
  runsStandalone: boolean;
  files: ImportSessionFile[];
  totalBytes: number;
  /** Every distinct object digest the release needs. */
  objectDigests: Set<string>;
  /** Objects still absent from the depot at open time, minus what arrived. */
  missing: Set<string>;
  uploadedBytes: number;
  status: ImportSessionStatus;
  createdAt: number;
  expiresAt: number;
  committedDigest?: string;
  committedGameId?: string;
  committedVersionId?: string;
}

export interface ImportOpenResult {
  session: ImportSession;
  digest: string;
  missing: string[];
  totalObjects: number;
}

/**
 * Injectable so the route layer wires Prisma and the tests run hermetic.
 * Everything here is the record-writing the commit half needs; the CAS work
 * stays in this module.
 */
export interface ImportDatabase {
  /** Resolve an existing game by id, or fail loudly when it is gone. */
  findGame(id: string): Promise<{ id: string; name: string } | null>;
  /**
   * Create the game row for a brand-new imported title and return its id.
   * Implementations own the library placement and the uniqueness rules.
   */
  createImportedGame(input: {
    title: string;
    /** Content digest of the release; the Manual metadata identity. */
    digest: string;
  }): Promise<string>;
  nextVersionIndex(gameId: string): Promise<number>;
  createImportedVersion(input: {
    gameId: string;
    displayName: string;
    /** The published `gamedepot-droplet` manifest document. */
    manifest: DropletManifest;
    casManifestDigest: string;
    fileList: string[];
    versionIndex: number;
    /** Launcher-handoff flag as declared when the session opened. */
    runsStandalone: boolean;
  }): Promise<string>;
}

// --- session store ---------------------------------------------------------

const sessions = new Map<string, ImportSession>();

/** Drop sessions nobody finished; called lazily before every session op. */
function sweepExpired(now: number) {
  for (const [id, session] of sessions)
    if (session.status !== "uploading" || session.expiresAt < now)
      sessions.delete(id);
}

export function getImportSession(
  id: string,
  now = Date.now(),
): ImportSession | undefined {
  sweepExpired(now);
  return sessions.get(id);
}

function notFound(): never {
  throw createError({
    statusCode: 404,
    statusMessage: "Import session not found or expired",
  });
}

export function requireImportSession(
  id: string,
  now = Date.now(),
): ImportSession {
  const session = getImportSession(id, now);
  if (!session) notFound();
  return session;
}

// --- validation ------------------------------------------------------------

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message });
}

/**
 * Validate one declared file and resolve its chunks into store form.
 * The client sends sizes and digests; index/offset are derived here so a
 * lie about layout fails structurally rather than installing wrong bytes.
 */
function validateFile(input: ImportFileInput): ImportSessionFile {
  let path: string;
  try {
    path = safeLogicalPath(input.path);
  } catch {
    // The contract's 502 fits a lying provider; an import path is client input.
    badRequest(`Unsafe import path: ${input.path}`);
  }
  if (
    !Number.isSafeInteger(input.size) ||
    input.size < 0 ||
    input.size > MAX_FILE_SIZE
  )
    badRequest(`Import file ${path} has an invalid size`);
  if (!SHA256_HEX.test(input.sha256))
    badRequest(`Import file ${path} has a malformed digest`);
  const mode = (input.mode ?? 0o644) & 0o7777;
  const chunks: DepotChunk[] = [];
  let offset = 0;
  for (const [index, chunk] of input.chunks.entries()) {
    if (
      !Number.isSafeInteger(chunk.size) ||
      chunk.size < 1 ||
      chunk.size > DEPOT_CHUNK_SIZE
    )
      badRequest(`Import file ${path} chunk ${index} has an invalid size`);
    if (index < input.chunks.length - 1 && chunk.size !== DEPOT_CHUNK_SIZE)
      badRequest(
        `Import file ${path} chunk ${index} is not ${DEPOT_CHUNK_SIZE} bytes; only the last chunk may be short`,
      );
    if (!SHA256_HEX.test(chunk.sha256))
      badRequest(`Import file ${path} chunk ${index} has a malformed digest`);
    chunks.push({
      index,
      offset,
      size: chunk.size,
      sha256: chunk.sha256,
      object: `objects/${chunk.sha256.slice(0, 2)}/${chunk.sha256}`,
    });
    offset += chunk.size;
  }
  if (offset !== input.size)
    badRequest(
      `Import file ${path} chunks cover ${offset} bytes but the file declares ${input.size}`,
    );
  if (input.size > 0 && input.chunks.length === 0)
    badRequest(`Import file ${path} is not empty but declares no chunks`);
  if (input.size === 0 && input.chunks.length > 0)
    badRequest(`Import file ${path} is empty but declares chunks`);
  return { path, size: input.size, mode, sha256: input.sha256, chunks };
}

// --- open ------------------------------------------------------------------

async function objectExists(
  depotRoot: string,
  sha256: string,
): Promise<boolean> {
  try {
    const info = await stat(casObjectPath(depotRoot, sha256));
    return info.isFile();
  } catch {
    return false;
  }
}

/**
 * Validate a declared release and open a session against the depot.
 * Returns the digests the store does not have yet - the whole point: a
 * resync after a launcher patch uploads only what actually changed.
 */
export async function openImportSession(
  depotRoot: string,
  input: ImportOpenInput,
  db?: ImportDatabase,
  now = Date.now(),
): Promise<ImportOpenResult> {
  sweepExpired(now);
  if (sessions.size >= MAX_SESSIONS)
    throw createError({
      statusCode: 429,
      statusMessage: "Too many import sessions are already open",
    });
  const gameTitle = input.gameTitle?.trim();
  if (!gameTitle) badRequest("gameTitle is required");
  if (!Array.isArray(input.files) || input.files.length === 0)
    badRequest("At least one file is required");
  if (input.files.length > MAX_FILES)
    badRequest(`Refusing to import more than ${MAX_FILES} files`);

  const files: ImportSessionFile[] = [];
  const seen = new Set<string>();
  const objectDigests = new Set<string>();
  let totalBytes = 0;
  for (const file of input.files) {
    const validated = validateFile(file);
    if (seen.has(validated.path))
      badRequest(`Duplicate import path: ${validated.path}`);
    seen.add(validated.path);
    totalBytes += validated.size;
    for (const chunk of validated.chunks) objectDigests.add(chunk.sha256);
    files.push(validated);
  }
  if (totalBytes > MAX_TOTAL_BYTES)
    badRequest(
      `Import declares ${totalBytes} bytes, above the ${MAX_TOTAL_BYTES} limit`,
    );
  if (input.gameId) {
    if (!db)
      throw createError({
        statusCode: 500,
        statusMessage: "Import database port is not wired",
      });
    if (!(await db.findGame(input.gameId)))
      throw createError({ statusCode: 404, statusMessage: "Game not found" });
  }

  const missing = new Set<string>();
  for (const digest of objectDigests)
    if (!(await objectExists(depotRoot, digest))) missing.add(digest);

  const session: ImportSession = {
    id: randomUUID(),
    gameTitle,
    appVersion: input.appVersion?.trim() || null,
    gameId: input.gameId ?? null,
    device: input.device?.trim() || null,
    importer: input.importer?.trim() || null,
    runsStandalone: input.runsStandalone ?? true,
    files,
    totalBytes,
    objectDigests,
    missing,
    uploadedBytes: 0,
    status: "uploading",
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.set(session.id, session);
  return {
    session,
    digest: releaseDigest(session),
    missing: [...missing],
    totalObjects: objectDigests.size,
  };
}

/**
 * The digest a commit with the current store contents would produce.
 * Computed at open so the client can report what a resync will publish
 * before it ships a byte.
 */
function releaseDigest(session: ImportSession): string {
  return createDropletManifest(
    session.files.map((f) => ({
      path: f.path,
      mode: f.mode,
      content: { size: f.size, sha256: f.sha256, chunks: f.chunks },
    })),
  ).digest;
}

/** Which digests the session still needs; refreshes against the live store. */
export async function importSessionMissing(
  depotRoot: string,
  session: ImportSession,
): Promise<string[]> {
  if (session.status !== "uploading") return [];
  const stillMissing: string[] = [];
  for (const digest of session.objectDigests) {
    if (!session.missing.has(digest)) continue;
    if (await objectExists(depotRoot, digest)) session.missing.delete(digest);
    else stillMissing.push(digest);
  }
  return stillMissing;
}

export interface ImportSessionSummary {
  id: string;
  gameTitle: string;
  appVersion: string | null;
  gameId: string | null;
  status: ImportSessionStatus;
  totalFiles: number;
  totalBytes: number;
  totalObjects: number;
  uploadedBytes: number;
  missingObjects: number;
  releaseDigest: string;
  committedDigest?: string;
  gameIdResult?: string;
  versionId?: string;
}

export function importSessionSummary(
  session: ImportSession,
): ImportSessionSummary {
  return {
    id: session.id,
    gameTitle: session.gameTitle,
    appVersion: session.appVersion,
    gameId: session.gameId,
    status: session.status,
    totalFiles: session.files.length,
    totalBytes: session.totalBytes,
    totalObjects: session.objectDigests.size,
    uploadedBytes: session.uploadedBytes,
    missingObjects: session.missing.size,
    releaseDigest: releaseDigest(session),
    ...(session.committedDigest
      ? {
          committedDigest: session.committedDigest,
          gameIdResult: session.committedGameId,
          versionId: session.committedVersionId,
        }
      : {}),
  };
}

// --- object upload ----------------------------------------------------------

/**
 * Verify arriving bytes against the declared digest and store the object.
 * The client never supplies a path: bytes land where their own digest says
 * they live, and an object the store already has is deduped, not rewritten.
 */
export async function storeImportedObject(
  depotRoot: string,
  session: ImportSession,
  sha256: string,
  source: AsyncIterable<Uint8Array>,
): Promise<{ stored: boolean; deduped: boolean }> {
  if (session.status !== "uploading")
    throw createError({
      statusCode: 409,
      statusMessage: `Import session is ${session.status}`,
    });
  if (!isContentDigest(sha256))
    throw createError({
      statusCode: 400,
      statusMessage: "Not a content digest",
    });
  if (!session.objectDigests.has(sha256))
    throw createError({
      statusCode: 400,
      statusMessage: "This object is not part of the declared release",
    });

  const object = casObjectPath(depotRoot, sha256);
  try {
    if ((await stat(object)).isFile()) {
      session.missing.delete(sha256);
      return { stored: false, deduped: true };
    }
  } catch {
    /* the common case: not stored yet */
  }
  const hash = createHash("sha256");
  let size = 0;
  const temp = `${object}.${process.pid}.${randomUUID()}.import.tmp`;
  try {
    await mkdir(dirname(object), { recursive: true });
    const handle = await open(temp, "wx");
    try {
      for await (const part of source) {
        const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part);
        size += bytes.length;
        if (size > DEPOT_CHUNK_SIZE)
          throw createError({
            statusCode: 413,
            statusMessage: `Object exceeds ${DEPOT_CHUNK_SIZE} bytes`,
          });
        hash.update(bytes);
        await handle.writeFile(bytes);
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    const actual = hash.digest("hex");
    if (actual !== sha256 || size === 0)
      throw createError({
        statusCode: 422,
        statusMessage: `Uploaded bytes hash to ${actual}, not the declared digest`,
      });
    try {
      await rename(temp, object);
    } catch (error) {
      await unlink(temp).catch(() => {});
      // Concurrent writers land here once the other rename won: the object
      // exists and covers its digest, which is the only contract.
      try {
        await stat(object);
      } catch {
        throw error;
      }
      session.missing.delete(sha256);
      return { stored: false, deduped: true };
    }
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
  session.missing.delete(sha256);
  session.uploadedBytes += size;
  return { stored: true, deduped: false };
}

// --- commit ------------------------------------------------------------------

export interface ImportCommitResult {
  digest: string;
  gameId: string;
  versionId: string;
  fileCount: number;
  chunkCount: number;
  totalBytes: number;
  /** Objects this session actually uploaded (everything else deduped). */
  uploadedObjects: number;
  manifestPath: string;
}

/**
 * Publish the session's release: manifest last (a manifest always covers
 * complete bytes), provenance next to it, then the GameVersion row pinned to
 * the digest so the client download path picks it up by CAS.
 */
export async function commitImportSession(
  depotRoot: string,
  session: ImportSession,
  db: ImportDatabase,
  now = Date.now(),
): Promise<ImportCommitResult> {
  if (session.status !== "uploading")
    throw createError({
      statusCode: 409,
      statusMessage: `Import session is ${session.status}`,
    });
  const stillMissing = await importSessionMissing(depotRoot, session);
  if (stillMissing.length > 0)
    throw createError({
      statusCode: 409,
      statusMessage: `${stillMissing.length} of ${session.objectDigests.size} objects are still missing from the depot`,
    });

  const manifest = createDropletManifest(
    session.files.map((f) => ({
      path: f.path,
      mode: f.mode,
      content: { size: f.size, sha256: f.sha256, chunks: f.chunks },
    })),
  );
  const manifestPath = casManifestPath(depotRoot, manifest.digest);
  await writeDropletManifest(manifestPath, manifest);

  // Human-facing provenance: who claimed these bytes are this game, from
  // which machine. The manifest itself stays a pure content-addressed list.
  const metaPath = join(depotRoot, "manifests", `${manifest.digest}.meta.json`);
  const metaTmp = `${metaPath}.import-${session.id}.tmp`;
  await writeFile(
    metaTmp,
    JSON.stringify(
      {
        digest: manifest.digest,
        gameTitle: session.gameTitle,
        appVersion: session.appVersion,
        totalFiles: session.files.length,
        totalBytes: session.totalBytes,
        publishedAt: new Date(now).toISOString(),
        source: "local-import",
        importer: session.importer,
        device: session.device,
        runsStandalone: session.runsStandalone,
      },
      null,
      2,
    ),
  );
  await rename(metaTmp, metaPath);

  const gameId =
    session.gameId ??
    (await db.createImportedGame({
      title: session.gameTitle,
      digest: manifest.digest,
    }));
  const versionIndex = await db.nextVersionIndex(gameId);
  const versionId = await db.createImportedVersion({
    gameId,
    displayName: session.appVersion ?? session.gameTitle,
    manifest,
    casManifestDigest: manifest.digest,
    fileList: session.files
      .map((f) => f.path)
      .sort((a, b) => a.localeCompare(b, "en")),
    versionIndex,
    runsStandalone: session.runsStandalone,
  });

  session.status = "committed";
  session.committedDigest = manifest.digest;
  session.committedGameId = gameId;
  session.committedVersionId = versionId;

  return {
    digest: manifest.digest,
    gameId,
    versionId,
    fileCount: session.files.length,
    chunkCount: Object.keys(manifest.chunkIndex).length,
    totalBytes: session.totalBytes,
    uploadedObjects: session.uploadedBytes,
    manifestPath,
  };
}

export function cancelImportSession(session: ImportSession): void {
  if (session.status === "committed")
    throw createError({
      statusCode: 409,
      statusMessage: "A committed release cannot be cancelled",
    });
  session.status = "cancelled";
  sessions.delete(session.id);
}
