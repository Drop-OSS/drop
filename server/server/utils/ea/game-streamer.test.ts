import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { streamEaGameToCas } from "./game-streamer";
import { crc32 } from "./zip-manifest";
import { readDropletManifest } from "../depot/manifest";
/** Assert an h3-style typed error: a status code and, optionally, a message fragment. */
function typedError(statusCode: number, message?: RegExp) {
  return (error: unknown): boolean => {
    const thrown = error as {
      statusCode?: number;
      statusMessage?: string;
      message?: string;
    } | null;
    const text = thrown?.statusMessage ?? thrown?.message ?? "";
    return (
      thrown?.statusCode === statusCode &&
      (message === undefined || message.test(text))
    );
  };
}
/** Some lib configurations do not type Buffer as a valid Response body. */
function binaryResponse(bytes: Buffer, init?: ResponseInit): Response {
  return new Response(new Uint8Array(bytes), init);
}

/**
 * Hermetic EA streamer tests. Each test builds a *real* ZIP archive in memory
 * (local headers, central directory, EOCD) and serves it through a fetch stub
 * that implements HTTP Range requests, so the whole remote-ZIP path is proven:
 * directory parse -> byte-range fetch -> raw inflate -> CRC32 -> depot CAS.
 */

const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const ARCHIVE_URL = "https://cdn.ea.com/packages/game.zip";

type ZipEntry = { name: string; bytes: Buffer; deflate?: boolean };

/** Minimal ZIP writer: enough of the format for the parser to accept it. */
function buildZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const body = entry.deflate ? deflateRawSync(entry.bytes) : entry.bytes;
    const method = entry.deflate ? 8 : 0;
    const crc = crc32(entry.bytes);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));

    offset += 30 + name.length + body.length;
  }

  const directory = Buffer.concat(centrals);
  const directoryOffset = offset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(directoryOffset, 16);

  return Buffer.concat([...locals, directory, eocd]);
}

const originalFetch = globalThis.fetch;

type FetchLog = { method: string; range: string | null };

/** Serves `archive` over HTTPS with real Range semantics. */
function serveArchive(
  archive: Buffer,
  options: { honorRanges?: boolean } = {},
) {
  const honorRanges = options.honorRanges !== false;
  const requests: FetchLog[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url !== ARCHIVE_URL)
      throw new Error(`Unexpected network request in test: ${url}`);
    const method = (init?.method ?? "GET").toUpperCase();
    const range =
      ((init?.headers as Record<string, string>)?.Range as string) ?? null;
    requests.push({ method, range });

    if (method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-length": String(archive.length) },
      });
    }
    if (range && honorRanges) {
      const [, start, end] = range.match(/bytes=(\d+)-(\d+)/)!;
      const slice = archive.subarray(Number(start), Number(end) + 1);
      return binaryResponse(slice, {
        status: 206,
        headers: {
          "content-range": `bytes ${start}-${end}/${archive.length}`,
          "content-length": String(slice.length),
        },
      });
    }
    // A server that ignores Range answers with the whole object: unacceptable
    // for a multi-gigabyte archive, so the adapter must refuse it.
    return binaryResponse(archive, {
      status: 200,
      headers: { "content-length": String(archive.length) },
    });
  }) as typeof fetch;
  return requests;
}

async function dirs() {
  const root = await mkdtemp(join(tmpdir(), "gamedepot-ea-"));
  return {
    root,
    objectsDir: join(root, "objects"),
    manifestsDir: join(root, "manifests"),
  };
}

/** Nothing may be published on a failed acquisition: the manifests dir stays
 * absent or empty. */
async function publishedManifests(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

test("streamEaGameToCas publishes stored and deflated ZIP entries", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  const config = Buffer.from('{"game":"needs for speed"}');
  const video = Buffer.from("EA-VIDEO-STREAM".repeat(200));
  const archive = buildZip([
    { name: "game/config.json", bytes: config },
    { name: "game/video.bik", bytes: video, deflate: true },
    { name: "game/", bytes: Buffer.alloc(0) }, // directory marker carries no content
  ]);
  serveArchive(archive);

  const { manifestPath } = await streamEaGameToCas({
    archiveUrl: ARCHIVE_URL,
    objectsDir,
    manifestsDir,
    gameTitle: "Need for Speed",
    appVersion: "1.0.0",
  });

  const manifest = await readDropletManifest(manifestPath);
  assert.deepEqual(
    manifest.files.map((f) => f.path),
    ["game/config.json", "game/video.bik"],
  );
  const byPath = new Map(manifest.files.map((f) => [f.path, f]));
  assert.equal(byPath.get("game/config.json")!.sha256, sha256(config));
  assert.equal(byPath.get("game/video.bik")!.sha256, sha256(video));
  assert.equal(byPath.get("game/video.bik")!.size, video.length);

  await rm(root, { recursive: true, force: true });
});

test("streamEaGameToCas fails closed on a CRC32 mismatch and publishes nothing", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  const archive = buildZip([
    { name: "game/data.bin", bytes: Buffer.from("AAAA") },
  ]);
  // Flip a byte of the stored payload (first entry's data begins right after
  // its 30-byte local header plus name) without touching the declared CRC32.
  const payloadAt = 30 + "game/data.bin".length;
  assert.equal(archive[payloadAt], 0x41);
  archive[payloadAt] = 0x42;
  serveArchive(archive);

  await assert.rejects(
    streamEaGameToCas({
      archiveUrl: ARCHIVE_URL,
      objectsDir,
      manifestsDir,
      gameTitle: "T",
      appVersion: "1",
    }),
    /CRC32 mismatch/,
  );
  assert.deepEqual(
    await publishedManifests(manifestsDir),
    [],
    "no manifest may be published",
  );

  await rm(root, { recursive: true, force: true });
});

test("streamEaGameToCas refuses an archive whose server ignores Range", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  const archive = buildZip([{ name: "a.bin", bytes: Buffer.from("data") }]);
  serveArchive(archive, { honorRanges: false });

  await assert.rejects(
    streamEaGameToCas({
      archiveUrl: ARCHIVE_URL,
      objectsDir,
      manifestsDir,
      gameTitle: "T",
      appVersion: "1",
    }),
    /byte range/i,
  );
  assert.deepEqual(await publishedManifests(manifestsDir), []);

  await rm(root, { recursive: true, force: true });
});

test("streamEaGameToCas rejects unsafe entry paths before downloading content", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  const archive = buildZip([
    { name: "game/ok.bin", bytes: Buffer.from("fine") },
    { name: "../escape.bin", bytes: Buffer.from("bad") },
  ]);
  const requests = serveArchive(archive);

  await assert.rejects(
    streamEaGameToCas({
      archiveUrl: ARCHIVE_URL,
      objectsDir,
      manifestsDir,
      gameTitle: "T",
      appVersion: "1",
    }),
    typedError(502, /Unsafe EA ZIP entry path/),
  );
  // Only the trailer and central-directory ranges may be fetched; no entry
  // payload is requested once a path is rejected.
  const rangeRequests = requests.filter((r) => r.method === "GET");
  assert.equal(
    rangeRequests.length,
    2,
    "expected exactly the trailer and directory fetches",
  );
  assert.deepEqual(await publishedManifests(manifestsDir), []);

  await rm(root, { recursive: true, force: true });
});

test("streamEaGameToCas rejects a non-HTTPS archive URL", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  let touched = false;
  globalThis.fetch = (async () => {
    touched = true;
    return new Response("{}");
  }) as typeof fetch;

  await assert.rejects(
    streamEaGameToCas({
      archiveUrl: "http://cdn.ea.com/packages/game.zip",
      objectsDir,
      manifestsDir,
      gameTitle: "T",
      appVersion: "1",
    }),
    /HTTPS/i,
  );
  assert.equal(touched, false);

  await rm(root, { recursive: true, force: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});
