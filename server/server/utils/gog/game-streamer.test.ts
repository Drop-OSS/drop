import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { streamGogGameToDepot, type StreamJobStore } from "./game-streamer";
import { readDropletManifest } from "../depot/manifest";

/**
 * Hermetic streamer tests against the live-verified (Nov 2026) content-system
 * shapes: the build list (`items[]`, snake_case) links a zlib build meta that
 * carries depots[], each depot manifest is a zlib {depot:{items}} document on
 * the content CDN, chunks are fetched through secure_link-signed endpoints,
 * stored zlib-compressed and MD5-verified in both forms. A release must never
 * be published unless every chunk verified.
 */

const PRODUCT_ID = "1207658776";
const BUILD_LINK = "https://meta.cdn.invalid/content-system/v2/meta/aa/bb/buildmeta";
const DEPOT_MANIFEST = "aabbccddeeff00112233445566778899";
const CHUNK_BASE = "https://chunk.cdn.invalid";

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

const md5 = (bytes: Buffer) => createHash("md5").update(bytes).digest("hex");
const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

/** Some lib configurations do not type Buffer as a valid Response body. */
function binaryResponse(bytes: Buffer, init?: ResponseInit): Response {
  return new Response(new Uint8Array(bytes), init);
}

function zlibJson(value: unknown): Buffer {
  return deflateSync(Buffer.from(JSON.stringify(value)));
}

/** A v2 depot chunk: served bytes are the stored (zlib) form. */
type ChunkStub = {
  md5: string;
  size: number;
  compressedMd5: string;
  compressedSize: number;
  served: Buffer;
};

function gogChunk(
  bytes: Buffer,
  overrides: Partial<ChunkStub> = {},
): ChunkStub {
  const served = deflateSync(bytes);
  return {
    md5: md5(bytes),
    size: bytes.length,
    compressedMd5: md5(served),
    compressedSize: served.length,
    served,
    ...overrides,
  };
}

function depotFileItem(path: string, chunks: ChunkStub[]) {
  return {
    type: "DepotFile",
    path,
    md5: md5(Buffer.concat([])), // unused by the streamer; shape parity
    chunks,
  };
}

const originalFetch = globalThis.fetch;

/** Route stubs; an unmatched URL fails the test loudly instead of reaching out. */
function stubFetch(
  routes: Array<{ match: RegExp; respond: (url: string) => Response }>,
) {
  const requested: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    requested.push(url);
    const route = routes.find((r) => r.match.test(url));
    if (!route) throw new Error(`Unexpected network request in test: ${url}`);
    return route.respond(url);
  }) as typeof fetch;
  return requested;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function buildsRoute(items: unknown[]) {
  return {
    match: /content-system\.gog\.com\/products\/.*\/builds/,
    respond: () => jsonResponse({ items }),
  };
}

function buildMetaRoute(depots: unknown[]) {
  return {
    match: /^https:\/\/meta\.cdn\.invalid\//,
    respond: () =>
      binaryResponse(
        zlibJson({
          version: 2,
          baseProductId: PRODUCT_ID,
          buildId: "build-1",
          installDirectory: "Test Game",
          depots,
        }),
        { headers: { "content-type": "application/octet-stream" } },
      ),
  };
}

const BASE_DEPOT = {
  manifest: DEPOT_MANIFEST,
  productId: PRODUCT_ID,
  languages: ["*"],
};

function depotManifestRoute(items: unknown[]) {
  return {
    match: /gog-cdn-fastly\.gog\.com\/content-system\/v2\/meta\//,
    respond: () =>
      binaryResponse(zlibJson({ version: 2, depot: { items } }), {
        headers: { "content-type": "application/octet-stream" },
      }),
  };
}

function secureLinkRoute(urls?: unknown[]) {
  return {
    match: /content-system\.gog\.com\/products\/.*\/secure_link/,
    respond: () =>
      jsonResponse({
        product_id: PRODUCT_ID,
        type: "store",
        urls:
          urls ?? [
            {
              endpoint_name: "default",
              url_format: "{base_url}/{path}?wsSecret={token}&wsTime={time}&prefix={prefix}",
              parameters: {
                base_url: CHUNK_BASE,
                path: `content-system/v2/store/${PRODUCT_ID}`,
                token: "sekret",
                time: "deadbeef",
                prefix: `/content-system/v2/store/${PRODUCT_ID}/`,
              },
            },
          ],
      }),
  };
}

/** Serves chunks by the galaxy path appended to the signed URL. */
function chunkRoutes(chunks: ChunkStub[]) {
  return {
    match: /chunk\.cdn\.invalid/,
    respond: (url: string) => {
      const key = url.split("?")[0].split("/").pop()!;
      const chunk = chunks.find((c) => c.compressedMd5 === key);
      return chunk
        ? binaryResponse(chunk.served)
        : new Response("gone", { status: 404 });
    },
  };
}

function makeStore() {
  const updates: Array<Record<string, unknown>> = [];
  const store: StreamJobStore = {
    async update(input) {
      updates.push(input as unknown as Record<string, unknown>);
    },
  };
  return { store, updates };
}

async function depotRoot() {
  const root = await mkdtemp(join(tmpdir(), "gamedepot-gog-"));
  return { root, path: join(root, "depot") };
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

test("streamGogGameToDepot publishes a release through the secure-link chain", async () => {
  const { root, path } = await depotRoot();
  const plain = Buffer.from("gog-stored-chunk-content".repeat(4));
  const zipped = Buffer.from("deflated-chunk-payload".repeat(8));
  const first = gogChunk(plain);
  const second = gogChunk(zipped);

  stubFetch([
    buildsRoute([
      {
        build_id: "build-1",
        product_id: PRODUCT_ID,
        os: "windows",
        version_name: "1.0.0",
        generation: 2,
        link: BUILD_LINK,
      },
    ]),
    buildMetaRoute([BASE_DEPOT]),
    depotManifestRoute([
      depotFileItem("game/data.bin", [first]),
      depotFileItem("game/text.dat", [second]),
    ]),
    secureLinkRoute(),
    chunkRoutes([first, second]),
  ]);

  const { store, updates } = makeStore();
  const manifestPath = await streamGogGameToDepot({
    jobId: "job-1",
    productId: PRODUCT_ID,
    accessToken: "token",
    depotRoot: path,
    store,
  });

  const published = await readDropletManifest(manifestPath);
  assert.equal(published.format, "gamedepot-droplet");
  const byPath = new Map(published.files.map((f) => [f.path, f]));
  assert.equal(byPath.get("game/data.bin")!.sha256, sha256(plain));
  assert.equal(byPath.get("game/text.dat")!.sha256, sha256(zipped));
  assert.equal(byPath.get("game/text.dat")!.size, zipped.length);

  assert.equal(updates.at(-1)!.status, "COMPLETED");
  assert.equal(updates.at(-1)!.progress, 100);
  assert.equal(updates.at(-1)!.manifestPath, manifestPath);

  // Every chunk the manifest points at must really exist and digest to its key.
  for (const [sha, entry] of Object.entries(published.chunkIndex)) {
    const stored = await readFile(join(path, entry.object));
    assert.equal(
      sha256(stored),
      sha,
      `CAS object ${entry.object} must match its key`,
    );
    assert.equal(stored.length, entry.size);
  }

  await rm(root, { recursive: true, force: true });
});

test("streamGogGameToDepot concatenates provider chunks in manifest order", async () => {
  const { root, path } = await depotRoot();
  const a = Buffer.from("A".repeat(70000));
  const b = Buffer.from("B".repeat(30000));
  const ca = gogChunk(a);
  const cb = gogChunk(b);

  stubFetch([
    buildsRoute([
      { build_id: "build-1", product_id: PRODUCT_ID, link: BUILD_LINK },
    ]),
    buildMetaRoute([BASE_DEPOT]),
    depotManifestRoute([depotFileItem("game/big.pak", [ca, cb])]),
    secureLinkRoute(),
    chunkRoutes([ca, cb]),
  ]);

  const { store } = makeStore();
  const manifestPath = await streamGogGameToDepot({
    jobId: "job-multi",
    productId: PRODUCT_ID,
    accessToken: "token",
    depotRoot: path,
    store,
  });

  const published = await readDropletManifest(manifestPath);
  assert.equal(published.files[0].sha256, sha256(Buffer.concat([a, b])));
  assert.equal(published.files[0].size, a.length + b.length);
  // Depot chunking follows DEPOT_CHUNK_SIZE, not GOG's chunk boundaries: two
  // provider chunks under 4 MiB reassemble into one whole file and one CAS chunk.
  assert.equal(published.files[0].chunks.length, 1);
  assert.equal(published.files[0].chunks[0].size, a.length + b.length);

  await rm(root, { recursive: true, force: true });
});

test("a later depot overwrites an earlier path instead of failing", async () => {
  const { root, path } = await depotRoot();
  const base = Buffer.from("base-config-bytes");
  const override = Buffer.from("override-config-bytes!!");
  const c1 = gogChunk(base);
  const c2 = gogChunk(override);

  let manifestCalls = 0;
  stubFetch([
    buildsRoute([
      { build_id: "build-1", product_id: PRODUCT_ID, link: BUILD_LINK },
    ]),
    buildMetaRoute([
      BASE_DEPOT,
      { ...BASE_DEPOT, manifest: "ffeeddccbbaa99887766554433221100", isGogDepot: true },
    ]),
    {
      match: /gog-cdn-fastly\.gog\.com\/content-system\/v2\/meta\//,
      respond: () =>
        binaryResponse(
          zlibJson({
            version: 2,
            depot: {
              items:
                manifestCalls++ === 0
                  ? [depotFileItem("game/config.json", [c1])]
                  : [depotFileItem("game/config.json", [c2])],
            },
          }),
        ),
    },
    secureLinkRoute(),
    chunkRoutes([c1, c2]),
  ]);

  const { store } = makeStore();
  const manifestPath = await streamGogGameToDepot({
    jobId: "job-merge",
    productId: PRODUCT_ID,
    accessToken: "token",
    depotRoot: path,
    store,
  });

  const published = await readDropletManifest(manifestPath);
  assert.equal(published.files.length, 1);
  assert.equal(published.files[0].sha256, sha256(override));

  await rm(root, { recursive: true, force: true });
});

test("streamGogGameToDepot fails closed on a chunk MD5 mismatch and publishes nothing", async () => {
  const { root, path } = await depotRoot();
  const good = Buffer.from("AAAA");
  // Valid zlib bytes, wrong payload for the declared digest: only an MD5
  // check can catch it.
  const corrupt = gogChunk(Buffer.from("BBBB"), {
    md5: md5(good),
    size: good.length,
  });

  stubFetch([
    buildsRoute([
      { build_id: "build-1", product_id: PRODUCT_ID, link: BUILD_LINK },
    ]),
    buildMetaRoute([BASE_DEPOT]),
    depotManifestRoute([depotFileItem("bad.bin", [corrupt])]),
    secureLinkRoute(),
    chunkRoutes([corrupt]),
  ]);

  const { store, updates } = makeStore();
  await assert.rejects(
    streamGogGameToDepot({
      jobId: "job-bad",
      productId: PRODUCT_ID,
      accessToken: "token",
      depotRoot: path,
      store,
    }),
    /MD5 mismatch/,
  );

  assert.equal(updates.at(-1)!.status, "FAILED");
  assert.match(String(updates.at(-1)!.error), /MD5 mismatch/);
  assert.deepEqual(
    await publishedManifests(join(path, "manifests")),
    [],
    "no manifest may be published",
  );

  await rm(root, { recursive: true, force: true });
});

test("streamGogGameToDepot fails closed when chunks cannot satisfy the declared size", async () => {
  const { root, path } = await depotRoot();
  const body = Buffer.from("short");
  // The manifest entry claims 500 uncompressed bytes for this chunk; the
  // real inflated payload is 5. The contract must not pad or publish it.
  const chunk = gogChunk(body, { size: 500 });

  stubFetch([
    buildsRoute([
      { build_id: "build-1", product_id: PRODUCT_ID, link: BUILD_LINK },
    ]),
    buildMetaRoute([BASE_DEPOT]),
    depotManifestRoute([depotFileItem("lying.bin", [chunk])]),
    secureLinkRoute(),
    chunkRoutes([chunk]),
  ]);

  const { store, updates } = makeStore();
  await assert.rejects(
    streamGogGameToDepot({
      jobId: "job-size",
      productId: PRODUCT_ID,
      accessToken: "token",
      depotRoot: path,
      store,
    }),
    /length mismatch/,
  );
  assert.equal(updates.at(-1)!.status, "FAILED");
  assert.deepEqual(await publishedManifests(join(path, "manifests")), []);

  await rm(root, { recursive: true, force: true });
});

test("streamGogGameToDepot reports typed 404s for a missing build or depot manifest", async () => {
  const { root, path } = await depotRoot();
  const { store, updates } = makeStore();

  stubFetch([buildsRoute([])]);
  await assert.rejects(
    streamGogGameToDepot({
      jobId: "job-empty",
      productId: PRODUCT_ID,
      accessToken: "token",
      depotRoot: path,
      store,
    }),
    typedError(404, /No GOG build/),
  );
  assert.equal(updates.at(-1)!.status, "FAILED");

  stubFetch([
    buildsRoute([
      { build_id: "build-2", product_id: PRODUCT_ID, link: BUILD_LINK },
    ]),
    buildMetaRoute([]),
  ]);
  await assert.rejects(
    streamGogGameToDepot({
      jobId: "job-none",
      productId: PRODUCT_ID,
      accessToken: "token",
      depotRoot: path,
      store,
    }),
    typedError(404, /no depot manifest/),
  );

  stubFetch([
    buildsRoute([
      { build_id: "build-1", product_id: PRODUCT_ID, link: BUILD_LINK },
    ]),
    buildMetaRoute([BASE_DEPOT]),
    depotManifestRoute([]),
  ]);
  await assert.rejects(
    streamGogGameToDepot({
      jobId: "job-nofiles",
      productId: PRODUCT_ID,
      accessToken: "token",
      depotRoot: path,
      store,
    }),
    typedError(404, /No files found/),
  );

  await rm(root, { recursive: true, force: true });
});

test("depot language and bitness filters keep unrelated depots out", async () => {
  const { root, path } = await depotRoot();
  const chunk = gogChunk(Buffer.from("en-US content"));
  const requested = stubFetch([
    buildsRoute([
      { build_id: "build-1", product_id: PRODUCT_ID, link: BUILD_LINK },
    ]),
    buildMetaRoute([
      { manifest: "dead000000000000000000000000beef", languages: ["de-DE"] },
      { manifest: "32000000000000000000000000000032", osBitness: ["32"] },
      { manifest: "otherproduct000000000000000000dl", productId: "999" },
      BASE_DEPOT,
    ]),
    {
      match: /gog-cdn-fastly\.gog\.com\/content-system\/v2\/meta\//,
      respond: (url) => {
        // Only the base depot may be requested; anything else fails loudly
        // through the URL in the thrown manifest error.
        assert.ok(url.includes(DEPOT_MANIFEST), `unexpected depot: ${url}`);
        return binaryResponse(
          zlibJson({
            version: 2,
            depot: { items: [depotFileItem("f.bin", [chunk])] },
          }),
        );
      },
    },
    secureLinkRoute(),
    chunkRoutes([chunk]),
  ]);

  const { store } = makeStore();
  await streamGogGameToDepot({
    jobId: "job-filter",
    productId: PRODUCT_ID,
    accessToken: "token",
    depotRoot: path,
    store,
  });
  const manifestRequests = requested.filter((url) =>
    url.includes("gog-cdn-fastly"),
  );
  assert.equal(manifestRequests.length, 1);

  await rm(root, { recursive: true, force: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});
