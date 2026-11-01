import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchEpicManifestDownloadUrls,
  fetchEpicManifestBuffer,
  parseEpicBinaryManifest,
  PARSER_STATUS,
  type EpicAssetManifestInfo,
} from "./manifest";
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

/**
 * Hermetic transport tests for Epic's launcher content service. The proprietary
 * binary decoder is deliberately unimplemented; these tests pin down what *is*
 * implemented (endpoint resolution, mirror handling, HTTPS enforcement, size
 * caps) and assert the decoder stays loudly unavailable.
 */

const originalFetch = globalThis.fetch;

function stubFetch(
  routes: Array<{
    match: RegExp;
    respond: (url: string, init?: RequestInit) => Response;
  }>,
) {
  const requested: string[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    requested.push(url);
    const route = routes.find((r) => r.match.test(url));
    if (!route) throw new Error(`Unexpected network request in test: ${url}`);
    return route.respond(url, init);
  }) as typeof fetch;
  return requested;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ASSET: EpicAssetManifestInfo = {
  appName: "Fuelger",
  catalogItemId: "catalog-item",
  namespace: "fn-onion",
  buildVersion: "17.0.0",
  distributionPoint: "https://distribution.example.com",
};

const CONTENT_SERVICE = /launcher-public-service-prod06\.ol\.epicgames\.com/;

test("fetchEpicManifestDownloadUrls resolves the manifest location and chunk mirrors", async () => {
  const requested = stubFetch([
    {
      match: CONTENT_SERVICE,
      respond: () =>
        jsonResponse({
          elements: [
            {
              manifestLocation:
                "https://manifests.example.com/Windows_Fuelger.manifest",
              meta: {
                chunkDownloadBaseUrls: [
                  "https://cdn1.example.com",
                  "https://cdn2.example.com/",
                ],
              },
            },
          ],
        }),
    },
  ]);

  const info = await fetchEpicManifestDownloadUrls(ASSET, "token-abc");
  assert.equal(
    info.manifestDownloadUrl,
    "https://manifests.example.com/Windows_Fuelger.manifest",
  );
  // URLs are canonicalized (so a bare host gains a trailing slash) but never rewritten.
  assert.deepEqual(
    info.chunkBaseUrls.map((b) => b.replace(/\/$/, "")),
    ["https://cdn1.example.com", "https://cdn2.example.com"],
  );

  // The build is addressed by namespace, catalog item, app and version.
  const url = requested[0]!;
  assert.match(url, /namespace\/fn-onion/);
  assert.match(url, /catalogItem\/catalog-item/);
  assert.match(url, /appName\/Fuelger/);
  assert.match(url, /buildVersion\/17\.0\.0/);
});

test("fetchEpicManifestDownloadUrls sends the bearer token and falls back to the distribution point", async () => {
  let auth: string | undefined;
  stubFetch([
    {
      match: CONTENT_SERVICE,
      respond: (_url, init) => {
        auth = (init?.headers as Record<string, string>).Authorization;
        return jsonResponse({
          elements: [
            { manifestLocation: "https://manifests.example.com/m.manifest" },
          ],
        });
      },
    },
  ]);

  const info = await fetchEpicManifestDownloadUrls(ASSET, "token-xyz");
  assert.equal(auth, "Bearer token-xyz");
  assert.deepEqual(
    info.chunkBaseUrls.map((b) => b.replace(/\/$/, "")),
    ["https://distribution.example.com"],
  );
});

test("fetchEpicManifestDownloadUrls uses an already-resolved manifest URL without querying", async () => {
  const requested = stubFetch([
    { match: /.*/, respond: () => jsonResponse({}) },
  ]);
  const info = await fetchEpicManifestDownloadUrls(
    {
      ...ASSET,
      manifestUrl: "https://manifests.example.com/pre.bin",
      chunkBaseUrls: ["https://cdn.example.com"],
    },
    "token",
  );
  assert.equal(
    info.manifestDownloadUrl,
    "https://manifests.example.com/pre.bin",
  );
  assert.deepEqual(
    info.chunkBaseUrls.map((b) => b.replace(/\/$/, "")),
    ["https://cdn.example.com"],
  );
  assert.deepEqual(requested, []);
});

test("fetchEpicManifestDownloadUrls refuses non-HTTPS endpoints without requesting them", async () => {
  const requested = stubFetch([
    { match: /.*/, respond: () => jsonResponse({}) },
  ]);

  await assert.rejects(
    fetchEpicManifestDownloadUrls(
      { ...ASSET, manifestUrl: "http://manifests.example.com/m.bin" },
      "token",
    ),
    typedError(502, /non-HTTPS/),
  );
  assert.deepEqual(requested, []);
});

test("fetchEpicManifestDownloadUrls surfaces auth and empty answers as typed errors", async () => {
  stubFetch([
    {
      match: CONTENT_SERVICE,
      respond: () => jsonResponse({ error: "unauthorized" }, 401),
    },
  ]);
  await assert.rejects(
    fetchEpicManifestDownloadUrls(ASSET, "expired"),
    typedError(401, /rejected the access token/),
  );

  stubFetch([
    { match: CONTENT_SERVICE, respond: () => jsonResponse({ elements: [] }) },
  ]);
  await assert.rejects(
    fetchEpicManifestDownloadUrls(ASSET, "token"),
    typedError(404, /no manifest location/),
  );

  stubFetch([
    {
      match: CONTENT_SERVICE,
      respond: () =>
        jsonResponse({
          elements: [
            {
              manifestLocation: "https://m.example.com/m.bin",
              meta: { chunkDownloadBaseUrls: [] },
            },
          ],
        }),
    },
  ]);
  await assert.rejects(
    fetchEpicManifestDownloadUrls({ ...ASSET, distributionPoint: "" }, "token"),
    typedError(502, /no chunk distribution endpoints/),
  );
});

test("fetchEpicManifestBuffer rejects non-OK answers and oversized manifests", async () => {
  stubFetch([
    {
      match: /big\.example\.com/,
      respond: () =>
        new Response("x", {
          status: 200,
          headers: { "content-length": "99999999999" },
        }),
    },
    {
      match: /gone\.example\.com/,
      respond: () => new Response("nope", { status: 403 }),
    },
    {
      match: /ok\.example\.com/,
      respond: () => new Response(Buffer.from("manifest-bytes")),
    },
  ]);

  assert.deepEqual(
    await fetchEpicManifestBuffer("https://ok.example.com/m.bin"),
    Buffer.from("manifest-bytes"),
  );

  await assert.rejects(
    fetchEpicManifestBuffer("https://gone.example.com/m.bin"),
    typedError(403, /Failed to fetch Epic binary manifest \(403\)/),
  );

  await assert.rejects(
    fetchEpicManifestBuffer("https://big.example.com/m.bin"),
    typedError(502, /exceeds the accepted size limit/),
  );

  await assert.rejects(
    fetchEpicManifestBuffer("sftp://ok.example.com/m.bin"),
    typedError(502, /non-HTTPS/),
  );
});

test("fetchEpicManifestBuffer reports cancellation distinctly", async () => {
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    // Mirror real fetch behaviour: an already-aborted signal rejects the call.
    if (init?.signal?.aborted)
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    return new Response("x");
  }) as typeof fetch;

  await assert.rejects(
    fetchEpicManifestBuffer(
      "https://manifests.example.com/m.bin",
      controller.signal,
    ),
    typedError(499, /aborted/),
  );
});

test("parseEpicBinaryManifest stays explicitly unavailable", async () => {
  // A release published from a guessed file map would look valid while pointing
  // at the wrong chunks, so decoding must fail loudly until it is validated
  // against a real manifest sample.
  assert.equal(PARSER_STATUS, "unimplemented");
  assert.throws(
    () =>
      parseEpicBinaryManifest(
        Buffer.from([0x0c, 0xc0, 0xbe, 0x44, 0x00, 0x01]),
      ),
    typedError(501, /not implemented/i),
  );
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});
