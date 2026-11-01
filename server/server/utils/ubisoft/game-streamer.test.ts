import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { streamUbisoftGameToCas } from "./game-streamer";
import type { UbisoftFileRecord } from "./client";
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
 * Hermetic streamer tests: Ubisoft's file CDN is a fetch stub, so these prove
 * the acquisition rules (HTTPS-only sources, declared sizes verified, nothing
 * published on failure) without any network access.
 */

const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

const originalFetch = globalThis.fetch;

function stubFetch(
  routes: Array<{ match: RegExp; respond: (url: string) => Response }>,
) {
  const requested: string[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    requested.push(url);
    const route = routes.find((r) => r.match.test(url));
    if (!route) throw new Error(`Unexpected network request in test: ${url}`);
    const response = route.respond(url);
    // Real fetch respects an already-aborted signal; the stub must too.
    if (init?.signal?.aborted) throw new Error("aborted");
    return response;
  }) as typeof fetch;
  return requested;
}

async function dirs() {
  const root = await mkdtemp(join(tmpdir(), "gamedepot-ubi-"));
  return {
    root,
    objectsDir: join(root, "objects"),
    manifestsDir: join(root, "manifests"),
  };
}

/** Nothing may be published on a failed acquisition. */
async function publishedManifests(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

const PAYLOAD = Buffer.from("ubisoft-assembly-kit-data".repeat(10));
const TEXT = Buffer.from("uplay://config");

const RECORDS: UbisoftFileRecord[] = [
  {
    fileId: "f1",
    path: "game/data.pak",
    size: PAYLOAD.length,
    source: "https://cdn.ubi.com/files/f1",
  },
  {
    fileId: "f2",
    path: "game/config.ini",
    size: TEXT.length,
    source: "https://cdn.ubi.com/files/f2",
  },
];

const BODY: Record<string, Buffer> = {
  "https://cdn.ubi.com/files/f1": PAYLOAD,
  "https://cdn.ubi.com/files/f2": TEXT,
};

const FILE_ROUTES = [
  {
    match: /cdn\.ubi\.com\/files\//,
    respond: (url: string) => {
      const bytes = BODY[url];
      return bytes
        ? binaryResponse(bytes, {
            status: 200,
            headers: { "content-length": String(bytes.length) },
          })
        : new Response("missing", { status: 404 });
    },
  },
];

test("streamUbisoftGameToCas publishes files with digests computed in transit", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  stubFetch(FILE_ROUTES);

  const progress: Array<{
    currentFile: string;
    fileIndex: number;
    transferredBytes: number;
    totalBytes: number;
  }> = [];
  const { manifest, manifestPath } = await streamUbisoftGameToCas({
    fileRecords: RECORDS,
    gameTitle: "Assassin Creed",
    appVersion: "1.0.216.7",
    objectsDir,
    manifestsDir,
    onProgress: (p) => progress.push(p),
  });

  assert.equal(manifest.format, "gamedepot-droplet");
  assert.deepEqual(await readDropletManifest(manifestPath), manifest);
  const byPath = new Map(manifest.files.map((f) => [f.path, f]));
  assert.equal(byPath.get("game/data.pak")!.sha256, sha256(PAYLOAD));
  assert.equal(byPath.get("game/config.ini")!.sha256, sha256(TEXT));
  assert.equal(byPath.get("game/data.pak")!.size, PAYLOAD.length);

  // Progress names every file, in manifest order, and ends fully accounted for.
  assert.deepEqual(
    [
      ...new Set(
        progress.filter((p) => p.currentFile).map((p) => p.currentFile),
      ),
    ],
    ["game/data.pak", "game/config.ini"],
  );
  assert.deepEqual(
    [...new Set(progress.filter((p) => p.currentFile).map((p) => p.fileIndex))],
    [1, 2],
  );
  const last = progress.at(-1)!;
  assert.equal(last.totalBytes, PAYLOAD.length + TEXT.length);
  assert.equal(last.transferredBytes, last.totalBytes);

  // The manifest's chunks must exist on disk and digest to their keys.
  for (const [sha, entry] of Object.entries(manifest.chunkIndex)) {
    assert.equal(
      sha256(
        await readFile(join(objectsDir, entry.object.slice("objects/".length))),
      ),
      sha,
    );
  }

  await rm(root, { recursive: true, force: true });
});

test("streamUbisoftGameToCas fails closed when a file is shorter than declared", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  stubFetch([
    {
      match: /files\/f1/,
      respond: () => new Response(Buffer.from("too short")),
    },
    ...FILE_ROUTES.slice(1),
  ]);

  await assert.rejects(
    streamUbisoftGameToCas({
      fileRecords: [
        {
          ...RECORDS[0],
          fileId: "short",
          source: "https://cdn.ubi.com/files/f1",
        },
      ],
      gameTitle: "T",
      appVersion: "1",
      objectsDir,
      manifestsDir,
    }),
    /length mismatch/,
  );
  assert.deepEqual(await publishedManifests(manifestsDir), []);

  await rm(root, { recursive: true, force: true });
});

test("streamUbisoftGameToCas refuses non-HTTPS sources without requesting them", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  const requested = stubFetch([
    { match: /.*/, respond: () => new Response("never") },
  ]);

  for (const source of [
    "http://cdn.ubi.com/files/x",
    "file:///etc/passwd",
    "https:/cdn.ubi.com/x",
  ]) {
    await assert.rejects(
      streamUbisoftGameToCas({
        fileRecords: [{ fileId: "x", path: "x.bin", size: 4, source }],
        gameTitle: "T",
        appVersion: "1",
        objectsDir,
        manifestsDir,
      }),
      typedError(502, /non-HTTPS/),
      source,
    );
  }
  assert.deepEqual(requested, [], "a rejected source must never be fetched");

  await rm(root, { recursive: true, force: true });
});

test("streamUbisoftGameToCas rejects unsafe or duplicate logical paths before transfer", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  const requested = stubFetch([
    { match: /.*/, respond: () => new Response("never") },
  ]);

  await assert.rejects(
    streamUbisoftGameToCas({
      fileRecords: [
        {
          fileId: "a",
          path: "../../escape",
          size: 1,
          source: "https://cdn.ubi.com/files/f1",
        },
      ],
      gameTitle: "T",
      appVersion: "1",
      objectsDir,
      manifestsDir,
    }),
    /Unsafe adapter file path/,
  );
  await assert.rejects(
    streamUbisoftGameToCas({
      fileRecords: [
        {
          fileId: "a",
          path: "same.bin",
          size: 1,
          source: "https://cdn.ubi.com/files/f1",
        },
        {
          fileId: "b",
          path: "same.bin",
          size: 1,
          source: "https://cdn.ubi.com/files/f2",
        },
      ],
      gameTitle: "T",
      appVersion: "1",
      objectsDir,
      manifestsDir,
    }),
    typedError(502, /Duplicate Ubisoft file path/),
  );
  assert.deepEqual(requested, []);

  await rm(root, { recursive: true, force: true });
});

test("streamUbisoftGameToCas stops on an abort and publishes nothing", async () => {
  const { root, objectsDir, manifestsDir } = await dirs();
  const controller = new AbortController();
  let served = 0;
  stubFetch([
    {
      match: /cdn\.ubi\.com/,
      respond: () => {
        served += 1;
        controller.abort();
        return new Response(PAYLOAD, { status: 200 });
      },
    },
  ]);

  await assert.rejects(
    streamUbisoftGameToCas({
      fileRecords: RECORDS,
      gameTitle: "T",
      appVersion: "1",
      objectsDir,
      manifestsDir,
      signal: controller.signal,
    }),
  );
  assert.equal(
    served,
    1,
    "the second file must not be requested after aborting",
  );
  assert.deepEqual(await publishedManifests(manifestsDir), []);

  await rm(root, { recursive: true, force: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});
