import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchGogProductInfo, parseGogProductInfo } from "./provider-info";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Trimmed from the live API payload (product 1711765822, Nov 2026): the
// description fields are HTML, images are product assets we do not mirror.
const PAYLOAD = {
  id: 1711765822,
  title: "Timberborn",
  slug: "timberborn",
  release_date: "2021-09-15T16:55:00+0200",
  images: {
    background: "//images-2.gog-statics.com/background.jpg",
    icon: "//images-1.gog-statics.com/icon.png",
    logo: "//images-3.gog-statics.com/logo_glx_logo.jpg",
  },
  description: {
    lead: "<p>Mankind turned Earth into a dry wasteland.</p>",
    full: [
      "<p>Mankind turned Earth into a dry wasteland.</p>",
      "<p>&nbsp;</p>",
      "<h4>Beaver societies</h4>",
      '<p><img src="https://items.gog.com/timberborn/factions.gif"></p>',
      "<p>Control one of two beaver factions.</p>",
    ].join("\n"),
    whats_cool_about_it: "",
  },
};

function stubFetch(payload: unknown, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(payload), { status });
  }) as typeof fetch;
  return calls;
}

test("the parser maps the catalogue payload onto game fields", () => {
  const info = parseGogProductInfo(PAYLOAD);
  assert.ok(info);
  assert.equal(info.title, "Timberborn");
  assert.equal(info.slug, "timberborn");
  assert.equal(info.releaseDate, "2021-09-15T16:55:00+0200");
  assert.equal(
    info.shortDescription,
    "Mankind turned Earth into a dry wasteland.",
  );
  // Images are dropped; headings and paragraphs survive as Markdown.
  assert.equal(
    info.description,
    [
      "Mankind turned Earth into a dry wasteland.",
      "",
      "#### Beaver societies",
      "",
      "Control one of two beaver factions.",
    ].join("\n"),
  );
});

test("the full description wins over the lead copy", () => {
  const info = parseGogProductInfo({
    ...PAYLOAD,
    description: { lead: "<p>Lead only.</p>", full: "<p>Full copy.</p>" },
  });
  assert.ok(info);
  assert.equal(info.shortDescription, "Lead only.");
  assert.equal(info.description, "Full copy.");
});

test("a missing title or slug is not a product", () => {
  assert.equal(parseGogProductInfo(null), undefined);
  assert.equal(parseGogProductInfo({}), undefined);
  assert.equal(parseGogProductInfo({ title: "Only a title" }), undefined);
  assert.equal(parseGogProductInfo({ slug: "only-a-slug" }), undefined);
});

test("the fetch uses the keyless products endpoint", async () => {
  const calls = stubFetch(PAYLOAD);
  const info = await fetchGogProductInfo(1711765822);
  assert.ok(info);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.gog.com/products/1711765822?expand=description",
  );
  assert.equal(calls[0].headers.accept, "application/json");
});

test("invalid ids never reach the network", async () => {
  const calls = stubFetch(PAYLOAD);
  assert.equal(await fetchGogProductInfo("abc"), undefined);
  assert.equal(await fetchGogProductInfo("0"), undefined);
  assert.equal(await fetchGogProductInfo("-1"), undefined);
  assert.equal(calls.length, 0);
});

test("a non-2xx answer throws so the caller can fall back", async () => {
  stubFetch({}, 404);
  await assert.rejects(
    () => fetchGogProductInfo(1711765822),
    /GOG product 1711765822 answered 404/,
  );
});
