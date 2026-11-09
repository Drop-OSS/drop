import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildGogAuthorizeUrl,
  exchangeGogAuthorizationCode,
  extractGogAuthCode,
  getGogLibrary,
} from "./gog";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("the GOG authorize URL uses the Heroic client and its registered redirect", () => {
  const url = new URL(buildGogAuthorizeUrl());
  assert.equal(url.origin + url.pathname, "https://auth.gog.com/auth");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("layout"), "galaxy");
  // GOG rejects any other client/redirect combo with "invalid client".
  assert.equal(url.searchParams.get("client_id"), "46899977096215655");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://embed.gog.com/on_login_success?origin=client",
  );
});

test("a full embed sign-in URL is reduced to its code", () => {
  assert.equal(
    extractGogAuthCode(
      "https://embed.gog.com/on_login_success?origin=client&code=abc-123",
    ),
    "abc-123",
  );
  assert.equal(extractGogAuthCode(" abc-123 "), "abc-123");
});

test("the code exchange posts the code to GOG's token endpoint", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(
      JSON.stringify({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        user_id: "999",
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const tokens = await exchangeGogAuthorizationCode(
    "https://embed.gog.com/on_login_success?origin=client&code=the-code",
  );
  assert.equal(tokens.user_id, "999");
  const sent = new URL(calls[0] as string);
  assert.equal(sent.origin + sent.pathname, "https://auth.gog.com/token");
  assert.equal(sent.searchParams.get("grant_type"), "authorization_code");
  assert.equal(sent.searchParams.get("code"), "the-code");
  assert.equal(
    sent.searchParams.get("redirect_uri"),
    "https://embed.gog.com/on_login_success?origin=client",
  );
});

/** Stub the three documented account endpoints per URL, recording calls. */
function mockGogAccount(handlers: {
  owned?: unknown;
  products?: (page: string | null) => unknown;
  details?: (id: string) => unknown;
}) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const href = String(url);
    calls.push({
      url: href,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    const u = new URL(href);
    if (u.pathname === "/user/data/games") {
      return new Response(JSON.stringify(handlers.owned ?? { owned: [] }), {
        status: 200,
      });
    }
    if (u.pathname === "/account/getFilteredProducts") {
      return new Response(
        JSON.stringify(handlers.products?.(u.searchParams.get("page")) ?? {}),
        { status: 200 },
      );
    }
    if (u.pathname.startsWith("/account/gameDetails/")) {
      const id = u.pathname
        .slice("/account/gameDetails/".length)
        .replace(/\.json$/, "");
      return new Response(JSON.stringify(handlers.details?.(id) ?? []), {
        status: 200,
      });
    }
    throw new Error(`unexpected fetch: ${href}`);
  }) as typeof fetch;
  return calls;
}

test("the library uses the documented endpoints with the Bearer header", async () => {
  const calls = mockGogAccount({
    owned: { owned: [1711765822] },
    products: () => ({
      totalPages: 1,
      products: [
        {
          id: 1711765822,
          title: "Timberborn",
          worksOn: { Windows: true, Mac: true, Linux: false },
        },
        { id: "junk", title: "Broken entry" },
      ],
    }),
  });
  const games = await getGogLibrary("token-123");
  const seen = calls.map((c) => new URL(c.url));
  assert.ok(
    seen.some((u) => u.pathname === "/account/getFilteredProducts"),
    "the titled product list is consulted",
  );
  assert.ok(
    seen.some((u) => u.pathname === "/user/data/games"),
    "the documented owned-ids anchor is consulted",
  );
  const products = seen.find(
    (u) => u.pathname === "/account/getFilteredProducts",
  )!;
  assert.equal(products.searchParams.get("mediaType"), "1");
  for (const call of calls)
    assert.equal(call.headers.Authorization, "Bearer token-123");
  assert.equal(games.length, 1, "invalid ids are dropped");
  assert.equal(games[0]?.id, "1711765822");
  assert.equal(games[0]?.title, "Timberborn");
  assert.deepEqual(games[0]?.worksOn, ["windows", "mac"]);
});

test("a login-page redirect from the library means the token is dead", async () => {
  globalThis.fetch = (async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://gog.com/login" },
    })) as typeof fetch;
  await assert.rejects(
    () => getGogLibrary("expired-token"),
    (err: unknown) => {
      const e = err as { statusCode?: number; statusMessage?: string };
      assert.equal(e.statusCode, 403);
      assert.match(e.statusMessage ?? "", /rejected the access token/);
      return true;
    },
  );
});

test("library pages are followed until totalPages", async () => {
  const calls = mockGogAccount({
    owned: { owned: [101, 102] },
    products: (page) => ({
      totalPages: 2,
      products: [{ id: 100 + Number(page), title: `Game ${page}` }],
    }),
  });
  const games = await getGogLibrary("token");
  const productPages = calls.filter(
    (c) => new URL(c.url).pathname === "/account/getFilteredProducts",
  ).length;
  assert.equal(productPages, 2);
  assert.deepEqual(
    games.map((g) => g.title),
    ["Game 1", "Game 2"],
  );
});

test("owned products the filtered list hid come back through gameDetails", async () => {
  const calls = mockGogAccount({
    owned: { owned: [201, 202, 203] },
    products: () => ({
      totalPages: 1,
      products: [{ id: 201, title: "Listed Game" }],
    }),
    details: (id) =>
      // 202: a real game the filtered view hid. 203: what GOG's clients
      // call not-a-game - DLC, bundle SKUs, extras, delisted leftovers -
      // which the documented details endpoint answers with [].
      id === "202"
        ? {
            title: "Hidden Gem",
            downloads: [["English", { windows: [{ name: "installer" }] }]],
          }
        : [],
  });
  const games = await getGogLibrary("token");
  assert.deepEqual(
    games.map((g) => g.title),
    ["Listed Game", "Hidden Gem"],
    "the titled product comes back, the empty-details extras stay out",
  );
  assert.equal(games[1]?.id, "202");
  const detailCalls = calls.filter((c) =>
    new URL(c.url).pathname.startsWith("/account/gameDetails/"),
  );
  assert.deepEqual(
    detailCalls.map((c) => new URL(c.url).pathname),
    ["/account/gameDetails/202.json", "/account/gameDetails/203.json"],
    "only ids missing from the filtered list get a details call",
  );
});
