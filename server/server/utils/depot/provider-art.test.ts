import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeArtUrl,
  cachedManifestArt,
  parseGogStorePage,
  fetchGogStoreArt,
} from "./provider-art";

const OG_HASH =
  "c75e674590b8947542c809924df30bbef2190341163dd08668e243c266be70c5";

/** The store page embeds product JSON with escaped slashes; the fixture
 * keeps that shape (it is what the parser's unescape step exists for). */
function storePageFixture(overrides?: {
  screenshots?: number;
  related?: boolean;
  omitProductBlock?: boolean;
}): string {
  const shotCount = overrides?.screenshots ?? 2;
  const shots = Array.from(
    { length: shotCount },
    (_, i) => `{"imageUrl":"https:\\/\\/images.gog-statics.com\\/shot${i}"}`,
  ).join(",");
  const productBlock =
    `"image":"https:\\/\\/images.gog-statics.com\\/${OG_HASH}",` +
    `"boxArtImage":"https:\\/\\/images.gog-statics.com\\/boxcover.jpg",` +
    `"bonuses":[],"screenshots":[${shots}],` +
    `"logo":"https:\\/\\/images.gog-statics.com\\/logo.png",` +
    `"publishers":[{"name":"Someone"}]`;
  // A related product after the main one: the parsers must not read into it.
  const related = overrides?.related
    ? `{"image":"https:\\/\\/images.gog-statics.com\\/other",` +
      `"boxArtImage":"https:\\/\\/images.gog-statics.com\\/related-box.jpg",` +
      `"screenshots":[{"imageUrl":"https:\\/\\/images.gog-statics.com\\/related-shot"}]}`
    : "";
  return [
    `<!doctype html><html><head>`,
    `<meta property="og:image" content="https://images.gog-statics.com/${OG_HASH}.jpg">`,
    `</head><body><script>window.__state = {"product":{${overrides?.omitProductBlock ? "" : productBlock}}${overrides?.related ? `,"related":[${related}]` : ""}};</script></body></html>`,
  ].join("");
}

test("store image URLs become absolute with an explicit extension", () => {
  // The CDN 404s the bare hash; live check Nov 2026 serves ".jpg".
  assert.equal(
    normalizeArtUrl(`//images-1.gog-statics.com/${OG_HASH}`),
    `https://images-1.gog-statics.com/${OG_HASH}.jpg`,
  );
  assert.equal(
    normalizeArtUrl("https://images.gog-statics.com/abc.png"),
    "https://images.gog-statics.com/abc.png",
  );
  assert.equal(normalizeArtUrl("http://insecure.example/a.jpg"), undefined);
  assert.equal(normalizeArtUrl("  "), undefined);
});

test("the cached library tile alone still yields a banner", () => {
  assert.deepEqual(cachedManifestArt(`//images-3.gog-statics.com/${OG_HASH}`), {
    banner: `https://images-3.gog-statics.com/${OG_HASH}.jpg`,
    carousel: [],
  });
  assert.equal(cachedManifestArt(null), undefined);
  assert.equal(cachedManifestArt(""), undefined);
});

test("the store page parser extracts banner, cover and screenshots", () => {
  const art = parseGogStorePage(storePageFixture());
  assert.ok(art);
  assert.equal(art.banner, `https://images.gog-statics.com/${OG_HASH}.jpg`);
  assert.equal(art.cover, "https://images.gog-statics.com/boxcover.jpg");
  assert.deepEqual(art.carousel, [
    "https://images.gog-statics.com/shot0.jpg",
    "https://images.gog-statics.com/shot1.jpg",
  ]);
});

test("related products after the main block are not mixed in", () => {
  const art = parseGogStorePage(storePageFixture({ related: true }));
  assert.ok(art);
  assert.equal(art.cover, "https://images.gog-statics.com/boxcover.jpg");
  assert.deepEqual(art.carousel, [
    "https://images.gog-statics.com/shot0.jpg",
    "https://images.gog-statics.com/shot1.jpg",
  ]);
});

test("a long screenshot list is capped", () => {
  const art = parseGogStorePage(storePageFixture({ screenshots: 20 }));
  assert.ok(art);
  assert.equal(art.carousel.length, 8);
});

test("pages without the product data degrade to nothing", () => {
  assert.equal(
    parseGogStorePage("<html><body>no meta</body></html>"),
    undefined,
  );
  assert.equal(
    parseGogStorePage(storePageFixture({ omitProductBlock: true })),
    undefined,
  );
});

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("the store page is fetched with a browser user agent", async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(storePageFixture(), { status: 200 });
  }) as typeof fetch;
  const art = await fetchGogStoreArt("cyberpunk_2077_game");
  assert.equal(
    calls[0]?.url,
    "https://www.gog.com/en/game/cyberpunk_2077_game",
  );
  assert.match(calls[0]!.headers["user-agent"], /Mozilla/);
  assert.equal(art?.banner, `https://images.gog-statics.com/${OG_HASH}.jpg`);
});

test("a store page failure throws; a junk slug never reaches the network", async () => {
  globalThis.fetch = (async () =>
    new Response("nope", { status: 503 })) as typeof fetch;
  await assert.rejects(() => fetchGogStoreArt("some_slug"), /503/);

  let touched = false;
  globalThis.fetch = (async () => {
    touched = true;
    return new Response("", { status: 200 });
  }) as typeof fetch;
  assert.equal(await fetchGogStoreArt("../etc/passwd"), undefined);
  assert.equal(await fetchGogStoreArt(""), undefined);
  assert.equal(touched, false);
});
