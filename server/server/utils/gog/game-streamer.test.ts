import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { parseGogInfo, streamGogGameToDepot } from "./game-streamer";

/**
 * Hermetic streamer tests against the live-verified (Nov 2026) content-system
 * shapes: the build list (`items[]`, snake_case) links a zlib build meta that
 * carries depots[], each depot manifest is a zlib {depot:{items}} document on
 * the content CDN, chunks are fetched through secure_link-signed endpoints,
 * stored zlib-compressed and MD5-verified in both forms. The streamer must
 * assemble an honest Filesystem-library tree and refuse to start the bulk
 * download for a build it cannot launch.
 */

const PRODUCT_ID = "1207658776";
const BUILD_LINK =
  "https://meta.cdn.invalid/content-system/v2/meta/aa/bb/buildmeta";
const DEPOT_MANIFEST = "aabbccddeeff00112233445566778899";

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

/** Some lib configurations do not type Buffer as a valid Response body. */
function binaryResponse(bytes: Buffer, init?: ResponseInit): Response {
  return new Response(new Uint8Array(bytes), init);
}

function zlibJson(value: unknown): Buffer {
  return deflateSync(Buffer.from(JSON.stringify(value)));
}

/** Served chunk bytes are the stored (zlib) form; both digests are honest by default. */
type ChunkStub = {
  md5: string;
  size: number;
  compressedMd5: string;
  compressedSize: number;
};

function makeChunkStore() {
  /** compressedMd5 (galaxy hash) -> bytes actually served */
  const served = new Map<string, Buffer>();
  return {
    /** Register honest chunk bytes; returns the depot-manifest chunk entry. */
    add(bytes: Buffer, overrides: Partial<ChunkStub> = {}): ChunkStub {
      const wire = deflateSync(bytes);
      const entry: ChunkStub = {
        md5: md5(bytes),
        size: bytes.length,
        compressedMd5: md5(wire),
        compressedSize: wire.length,
        ...overrides,
      };
      served.set(entry.compressedMd5, wire);
      return entry;
    },
    /** Tamper the wire bytes for a registered chunk without changing digests. */
    corrupt(chunk: ChunkStub) {
      served.set(chunk.compressedMd5, Buffer.from("tampered-bytes"));
    },
    route: {
      match: /chunk\.cdn\.invalid/,
      respond: (url: string): Response => {
        const hash = new URL(url).pathname.split("/").pop() ?? "";
        const bytes = served.get(hash);
        if (!bytes) {
          return new Response("no such chunk", { status: 404 });
        }
        return binaryResponse(bytes);
      },
    },
  };
}

function depotFileItem(path: string, chunks: ChunkStub[]) {
  return { type: "DepotFile", path, chunks };
}

const originalFetch = globalThis.fetch;

/** Route stubs; an unmatched URL fails the test loudly instead of reaching out. */
function stubFetch(
  routes: Array<{ match: RegExp; respond: (url: string) => Response }>,
) {
  const requested: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input instanceof URL ? input.toString() : input);
    requested.push(url);
    const route = routes.find((r) => r.match.test(url));
    if (!route) throw new Error(`Unexpected network request in test: ${url}`);
    return route.respond(url);
  }) as typeof fetch;
  return requested;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function infoDoc(executables: unknown[]) {
  return JSON.stringify({
    version: "1.0",
    taskId: `${PRODUCT_ID}.int.1`,
    installDirectory: "Test Game",
    executables,
  });
}

const GAME_EXECUTABLE = {
  name: "Play the game",
  path: "Test Game\\TestGame.exe",
  type: "Game",
  arguments: ["-skipintro"],
};

/** Everything the streamer calls, minus the depot items which tests supply. */
function baseRoutes(
  store: ReturnType<typeof makeChunkStore>,
  depotItems: unknown[],
  options: { versionName?: string } = {},
) {
  return [
    {
      match: /content-system\.gog\.com\/products\/.*\/builds/,
      respond: () =>
        new Response(
          JSON.stringify({
            items: [
              {
                build_id: "build-1",
                product_id: PRODUCT_ID,
                os: "windows",
                version_name: options.versionName ?? "1.0.0-gog",
                link: BUILD_LINK,
              },
            ],
          }),
          { status: 200 },
        ),
    },
    {
      match: /^https:\/\/meta\.cdn\.invalid\//,
      respond: () =>
        binaryResponse(
          zlibJson({
            version: 2,
            baseProductId: PRODUCT_ID,
            buildId: "build-1",
            depots: [
              {
                manifest: DEPOT_MANIFEST,
                productId: PRODUCT_ID,
                languages: ["*"],
              },
            ],
          }),
        ),
    },
    {
      match: /gog-cdn-fastly\.gog\.com\/content-system\/v2\/meta\//,
      respond: () => binaryResponse(zlibJson({ depot: { items: depotItems } })),
    },
    {
      match: /content-system\.gog\.com\/products\/.*\/secure_link/,
      respond: () =>
        new Response(
          JSON.stringify({
            urls: [
              {
                endpoint_name: "primary",
                url_format:
                  "https://chunk.cdn.invalid/{path}?wsSecret=tok&wsTime=1700000000",
                parameters: { path: "/content-system/v2/galaxy" },
                priority: 1,
              },
            ],
          }),
          { status: 200 },
        ),
    },
    store.route,
  ];
}

function streamOptions(gameDir: string) {
  return {
    productId: PRODUCT_ID,
    gameTitle: "Test Game",
    accessToken: "test-token",
    gameDir,
  };
}

test("assembles a Filesystem-library tree and reports launches", async () => {
  const store = makeChunkStore();
  const infoBytes = Buffer.from(infoDoc([GAME_EXECUTABLE]));
  const header = store.add(Buffer.from("SIGNATURE"));
  const payloadA = store.add(Buffer.from("AAA"));
  const payloadB = store.add(Buffer.from("BB"));
  const depotItems = [
    depotFileItem(`goggame-${PRODUCT_ID}.info.json`, [store.add(infoBytes)]),
    depotFileItem("Test Game\\TestGame.exe", [header, payloadA, payloadB]),
    depotFileItem("README.txt", [store.add(Buffer.from("readme"))]),
  ];
  const requested = stubFetch(
    baseRoutes(store, depotItems, {
      versionName: "1.1.2.8-ffc2de0-gw",
    }),
  );

  const gameDir = await mkdtemp(join(tmpdir(), "gog-tree-"));
  try {
    // A stale import from a previous run must be wiped for the fresh build.
    const staleDir = join(gameDir, "1.1.2.8-ffc2de0-gw");
    await mkdir(join(staleDir, "old"), { recursive: true });
    await writeFile(join(staleDir, "old", "stale.txt"), "delete me");

    const events: Array<{ phase: string; progress: number }> = [];
    const result = await streamGogGameToDepot({
      ...streamOptions(gameDir),
      onProgress: (update) =>
        events.push({ phase: update.phase, progress: update.progress }),
    });

    assert.equal(result.versionName, "1.1.2.8-ffc2de0-gw");
    assert.equal(result.versionDir, staleDir);
    assert.equal(result.installDirectory, "Test Game");
    assert.equal(result.fileCount, 3);
    assert.equal(
      result.totalBytes,
      infoBytes.length + "SIGNATURE".length + 3 + 2 + "readme".length,
    );
    assert.deepEqual(result.launches, [
      {
        name: "Play the game",
        executable: "Test Game/TestGame.exe",
        arguments: ["-skipintro"],
      },
    ]);

    // The tree landed on disk with exactly the assembled content.
    assert.equal(
      (await readFile(join(staleDir, "Test Game", "TestGame.exe"))).toString(),
      "SIGNATURE" + "AAA" + "BB",
    );
    assert.equal(
      (await readFile(join(staleDir, "README.txt"))).toString(),
      "readme",
    );
    assert.equal(
      (
        await readFile(join(staleDir, `goggame-${PRODUCT_ID}.info.json`))
      ).toString(),
      infoBytes.toString(),
    );
    await assert.rejects(readFile(join(staleDir, "old", "stale.txt")));

    // Launch metadata was acquired before any content file streamed.
    const infoHash = md5(deflateSync(infoBytes));
    const exeHash = md5(deflateSync(Buffer.from("SIGNATURE")));
    const infoAt = requested.findIndex((url) => url.includes(infoHash));
    const exeAt = requested.findIndex((url) => url.includes(exeHash));
    assert.ok(infoAt >= 0 && exeAt >= 0);
    assert.ok(infoAt < exeAt, "info.json must be fetched before game files");

    // Progress: honest lifecycle, monotonic, ends assembled.
    assert.equal(events[0]!.phase, "manifest_discovery");
    assert.ok(events.some((e) => e.phase === "launch_metadata"));
    assert.ok(events.some((e) => e.phase === "assembling_game_files"));
    assert.equal(events.at(-1)!.phase, "assembled");
    for (let i = 1; i < events.length; i++) {
      assert.ok(
        events[i]!.progress >= events[i - 1]!.progress,
        "progress must never run backwards",
      );
    }
  } finally {
    await rm(gameDir, { recursive: true, force: true });
  }
});

test("sanitizes the version directory name", async () => {
  const store = makeChunkStore();
  const depotItems = [
    depotFileItem(`goggame-${PRODUCT_ID}.info.json`, [
      store.add(Buffer.from(infoDoc([GAME_EXECUTABLE]))),
    ]),
    depotFileItem("a.txt", [store.add(Buffer.from("a"))]),
  ];
  stubFetch(baseRoutes(store, depotItems, { versionName: "1.0 <build 5>:2" }));

  const gameDir = await mkdtemp(join(tmpdir(), "gog-tree-"));
  try {
    const result = await streamGogGameToDepot(streamOptions(gameDir));
    assert.equal(result.versionName, "1.0__build_5__2");
    assert.equal(
      (await readFile(join(result.versionDir, "a.txt"))).toString(),
      "a",
    );
  } finally {
    await rm(gameDir, { recursive: true, force: true });
  }
});

test("refuses depot paths that escape the version directory", async () => {
  const store = makeChunkStore();
  const requested = stubFetch(
    baseRoutes(store, [
      depotFileItem("../../../etc/passwd", [store.add(Buffer.from("x"))]),
    ]),
  );

  const gameDir = await mkdtemp(join(tmpdir(), "gog-tree-"));
  try {
    await assert.rejects(
      streamGogGameToDepot(streamOptions(gameDir)),
      typedError(502, /unsafe file path/),
    );
    assert.ok(
      !requested.some((url) => url.includes("chunk.cdn.invalid")),
      "no chunk may be downloaded once a path is unsafe",
    );
  } finally {
    await rm(gameDir, { recursive: true, force: true });
  }
});

test("aborts before the bulk download when the game declares no launch", async () => {
  const store = makeChunkStore();
  const infoBytes = Buffer.from(
    infoDoc([{ name: "Editor", path: "editor.exe", type: "Tool" }]),
  );
  const gameChunk = store.add(Buffer.from("huge-game-payload"));
  const depotItems = [
    depotFileItem(`goggame-${PRODUCT_ID}.info.json`, [store.add(infoBytes)]),
    depotFileItem("Test Game/TestGame.exe", [gameChunk]),
  ];
  const requested = stubFetch(baseRoutes(store, depotItems));

  const gameDir = await mkdtemp(join(tmpdir(), "gog-tree-"));
  try {
    await assert.rejects(
      streamGogGameToDepot(streamOptions(gameDir)),
      typedError(422, /no launchable Game executable/),
    );
    assert.ok(
      !requested.some((url) => url.includes(gameChunk.compressedMd5)),
      "the game payload must never be fetched for an unlaunchable build",
    );
  } finally {
    await rm(gameDir, { recursive: true, force: true });
  }
});

test("fails when the build ships no game info document", async () => {
  const store = makeChunkStore();
  stubFetch(
    baseRoutes(store, [depotFileItem("a.txt", [store.add(Buffer.from("a"))])]),
  );

  const gameDir = await mkdtemp(join(tmpdir(), "gog-tree-"));
  try {
    await assert.rejects(
      streamGogGameToDepot(streamOptions(gameDir)),
      typedError(404, /ships no goggame/),
    );
  } finally {
    await rm(gameDir, { recursive: true, force: true });
  }
});

test("rejects a file whose assembled size disagrees with the manifest", async () => {
  const store = makeChunkStore();
  const lyingChunk = store.add(Buffer.from("three"), { size: 999 });
  const depotItems = [
    depotFileItem(`goggame-${PRODUCT_ID}.info.json`, [
      store.add(Buffer.from(infoDoc([GAME_EXECUTABLE]))),
    ]),
    depotFileItem("a.txt", [lyingChunk]),
  ];
  stubFetch(baseRoutes(store, depotItems));

  const gameDir = await mkdtemp(join(tmpdir(), "gog-tree-"));
  try {
    await assert.rejects(
      streamGogGameToDepot(streamOptions(gameDir)),
      typedError(502, /size mismatch/),
    );
  } finally {
    await rm(gameDir, { recursive: true, force: true });
  }
});

test("verifies chunk digests against tampered wire bytes", async () => {
  const store = makeChunkStore();
  const chunk = store.add(Buffer.from("pristine"));
  const depotItems = [
    depotFileItem(`goggame-${PRODUCT_ID}.info.json`, [
      store.add(Buffer.from(infoDoc([GAME_EXECUTABLE]))),
    ]),
    depotFileItem("a.txt", [chunk]),
  ];
  stubFetch(baseRoutes(store, depotItems));
  store.corrupt(chunk);

  const gameDir = await mkdtemp(join(tmpdir(), "gog-tree-"));
  try {
    await assert.rejects(
      streamGogGameToDepot(streamOptions(gameDir)),
      typedError(502, /Failed to fetch GOG chunk/),
    );
  } finally {
    await rm(gameDir, { recursive: true, force: true });
  }
});

test("parseGogInfo reads Galaxy-era and plateau schemas", () => {
  const galaxy = parseGogInfo(
    infoDoc([
      GAME_EXECUTABLE,
      { name: "Config", path: "config.exe", type: "Configuration" },
    ]),
  );
  assert.equal(galaxy.installDirectory, "Test Game");
  assert.equal(galaxy.launches.length, 1);
  assert.equal(galaxy.launches[0]!.executable, "Test Game/TestGame.exe");

  const plateau = parseGogInfo(
    JSON.stringify({
      plateau: {
        executables: [
          {
            name: "Play",
            path: "/game.elf",
            type: "Game",
            arguments: "-fullscreen",
          },
        ],
      },
    }),
  );
  assert.deepEqual(plateau.launches, [
    { name: "Play", executable: "game.elf", arguments: ["-fullscreen"] },
  ]);
});
