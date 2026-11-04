import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { discoverEaLibrary, normalizeEaGame } from "./library";

const originalFetch = globalThis.fetch;
const calls: string[] = [];

/** Routes mocked fetch by endpoint so entitlement/catalog calls are distinct. */
function mockFetch(
  routes: Array<{ match: string; status: number; body: unknown }>,
) {
  calls.length = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const href = String(url);
    calls.push(href);
    const route = routes.find((entry) => href.includes(entry.match));
    if (!route)
      return new Response("unexpected url", {
        status: 599,
      });
    return new Response(JSON.stringify(route.body), {
      status: route.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const ENTITLE = "ecommerce2/entitlements";
const JUNO = "proxy/identity";

test("normalizeEaGame accepts the live nested entitlement layout", () => {
  const game = normalizeEaGame({
    entitlementInfo: {
      id: "ent-1",
      offerId: "offer-off",
      appName: "legacy-name",
      baseGames: [
        {
          id: "bg-1",
          name: "Mass Effect Legendary Edition",
          downloadLink: "https://dl.example/me.zip",
        },
      ],
    },
  });
  assert.deepEqual(game, {
    id: "bg-1",
    title: "Mass Effect Legendary Edition",
    offerId: "offer-off",
  });
});

test("normalizeEaGame accepts the flat provisional layout", () => {
  const game = normalizeEaGame({
    entitlementId: "ent-2",
    offerId: "offer-flat",
    displayName: "It Takes Two",
  });
  assert.equal(game.id, "ent-2");
  assert.equal(game.title, "It Takes Two");
});

test("lists owned titles without contacting the catalog", async () => {
  mockFetch([
    {
      match: ENTITLE,
      status: 200,
      body: [
        {
          entitlementInfo: {
            offerId: "o1",
            baseGames: [{ id: "b1", name: "A" }],
          },
        },
      ],
    },
  ]);
  const result = await discoverEaLibrary("token", {});
  assert.equal(result.total, 1);
  assert.equal(result.games[0]?.title, "A");
  assert.equal(calls.length, 1, "catalog must not be called without a term");
});

test("filters owned titles case-insensitively by title", async () => {
  mockFetch([
    {
      match: ENTITLE,
      status: 200,
      body: [
        {
          entitlementInfo: {
            offerId: "o1",
            baseGames: [{ id: "b1", name: "Battlefield 2042" }],
          },
        },
        {
          entitlementInfo: {
            offerId: "o2",
            baseGames: [{ id: "b2", name: "Star Wars Jedi" }],
          },
        },
      ],
    },
  ]);
  const result = await discoverEaLibrary("token", { title: "battlefield" });
  assert.equal(result.total, 1);
  assert.equal(result.games[0]?.id, "b1");
});

test("merges catalog-only offers once, deduping shared offer ids", async () => {
  mockFetch([
    {
      match: "/entitlements",
      status: 200,
      body: [
        {
          entitlementInfo: {
            offerId: "shared",
            baseGames: [{ id: "b1", name: "Apex" }],
          },
        },
      ],
    },
    {
      match: JUNO,
      status: 200,
      body: {
        data: {
          offers: [
            { offerId: "shared", offerName: "Apex duplicate" },
            { offerId: "new-offer", offerName: "Need for Speed" },
          ],
        },
      },
    },
  ]);
  const result = await discoverEaLibrary("token", { search: "apex" });
  assert.deepEqual(
    result.games.map((game) => game.offerId),
    ["shared", "new-offer"],
  );
  assert.equal(result.total, 2);
});

test("degrades to owned titles when the unverified catalog query fails", async () => {
  mockFetch([
    {
      match: "/entitlements",
      status: 200,
      body: [
        {
          entitlementInfo: {
            offerId: "o1",
            baseGames: [{ id: "b1", name: "A" }],
          },
        },
      ],
    },
    { match: JUNO, status: 200, body: { errors: [{ message: "boom" }] } },
  ]);
  const result = await discoverEaLibrary("token", { search: "a" });
  assert.equal(result.total, 1);
  assert.equal(result.games[0]?.title, "A");
});

test("surfaces a rejected access token as 401", async () => {
  mockFetch([{ match: ENTITLE, status: 401, body: {} }]);
  await assert.rejects(
    () => discoverEaLibrary("bad-token", {}),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 401,
  );
});

test("help-session tokens discover through the player-shell endpoint", async () => {
  mockFetch([
    {
      match: "playershell",
      status: 200,
      body: {
        response: {
          trendingGames: [
            { title: "Mass Effect 2", pagePath: "/me2", entitled: true },
            { title: "Battlefield V", pagePath: "/bfv", entitled: true },
            { title: "Free Sample", pagePath: "/free", entitled: false },
          ],
        },
      },
    },
    {
      match: "entitlements",
      status: 401,
      body: {},
    },
  ]);
  const all = await discoverEaLibrary("help-session:userSessionId=abc");
  assert.deepEqual(
    all.games.map((g) => g.title),
    ["Mass Effect 2", "Battlefield V"],
  );
  assert.ok(
    calls.some((c) => c.includes("playershell")),
    "cookie-backed discovery must not call the entitlement API",
  );
  const one = await discoverEaLibrary("help-session:userSessionId=abc", {
    title: "battlefield",
  });
  assert.deepEqual(
    one.games.map((g) => g.title),
    ["Battlefield V"],
  );
});
