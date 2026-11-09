import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { H3Event } from "h3";
import { epicLibraryHandler } from "./library.get";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function event(url: string) {
  return new H3Event({ url, headers: {}, method: "GET" } as never, {} as never);
}

/** One base game in Epic's own spelling: a hash slug, a human name. */
const entitlements = [
  {
    id: "e1",
    entitlementName: "7ce1367f0ee846418b236dfe96d30c2c",
    namespace: "f9a9",
    catalogItemId: "7ce1367f0ee846418b236dfe96d30c2c",
    grantDate: "2024-01-02T00:00:00Z",
    displayName: "Death Stranding",
  },
  {
    id: "r1",
    entitlementName: "UE_5.2",
    namespace: "ue",
    catalogItemId: "enginebuild",
    grantDate: "2023-01-01T00:00:00Z",
    displayName: "Unreal Engine",
  },
];

test("rejects requests without a token", async () => {
  await assert.rejects(
    () => epicLibraryHandler(event("/api/admin/depot/epic/library")),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 401,
  );
});

test("requires the accountId the entitlements endpoint scopes to", async () => {
  await assert.rejects(
    () => epicLibraryHandler(event("/api/admin/depot/epic/library?token=abc")),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 400,
  );
});

test("lists entitled games by their human name and app name", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(entitlements), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  const result = (await epicLibraryHandler(
    event("/api/admin/depot/epic/library?token=abc&accountId=acc-1"),
  )) as {
    games: Array<{ title: string; appName: string }>;
    total: number;
  };
  assert.equal(result.total, 1, "the engine runtime is dropped");
  assert.equal(result.games[0]?.title, "Death Stranding");
  assert.equal(
    result.games[0]?.appName,
    "7ce1367f0ee846418b236dfe96d30c2c",
    "the ingest call gets the appName entitlements themselves lack",
  );
});

test("hash-named entitlements are named via the catalog service", async () => {
  // The live account's actual shape: entitlements arrive nameless (no
  // displayName at all), AUDIENCE rewards mixed in, names only answerable
  // by the catalog bulk lookup - exactly the two-call launcher flow.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/bulk/items")) {
      return new Response(
        JSON.stringify({
          "99999999999999999999999999999999": {
            title: "Shadow Complex Remastered",
          },
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify([
        {
          id: "h1",
          entitlementName: "99999999999999999999999999999999",
          namespace: "ns_hashtest",
          catalogItemId: "99999999999999999999999999999999",
          grantDate: "2022-03-03T00:00:00Z",
          entitlementType: "EXECUTABLE",
        },
        {
          id: "h2",
          entitlementName: "SomeRewardGrant",
          namespace: "ns_hashtest",
          catalogItemId: "88888888888888888888888888888888",
          grantDate: "2022-03-03T00:00:00Z",
          entitlementType: "AUDIENCE",
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  const result = (await epicLibraryHandler(
    event("/api/admin/depot/epic/library?token=abc&accountId=acc-1"),
  )) as {
    games: Array<{ title: string; appName: string }>;
    total: number;
  };
  assert.equal(result.total, 1, "the AUDIENCE reward grant is dropped");
  assert.equal(result.games[0]?.title, "Shadow Complex Remastered");
  assert.equal(result.games[0]?.appName, "99999999999999999999999999999999");
});

test("products come from the library service when it answers", async () => {
  // Epic's curated list is the primary source: product records with the
  // real install appName and a human sandboxName. The entitlement grants
  // endpoint is never consulted when it answers.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/library/api/public/items")) {
      return new Response(
        JSON.stringify({
          records: [
            {
              namespace: "ns_libprimary",
              catalogItemId: "cccccccccccccccccccccccccccccc01",
              appName: "Libprimary",
              sandboxName: "Grant of a Game",
            },
            {
              namespace: "ue",
              catalogItemId: "cccccccccccccccccccccccccccccc02",
              appName: "UE_5.5",
              sandboxName: "Unreal Engine",
            },
          ],
          responseMetadata: {},
        }),
        { status: 200 },
      );
    }
    if (url.includes("/bulk/items")) {
      return new Response(
        JSON.stringify({
          cccccccccccccccccccccccccccccc01: { title: "The Named Game" },
        }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
  const result = (await epicLibraryHandler(
    event("/api/admin/depot/epic/library?token=abc&accountId=acc-1"),
  )) as {
    games: Array<{ title: string; appName: string }>;
    total: number;
  };
  assert.equal(result.total, 1, "the engine record is dropped");
  assert.equal(
    result.games[0]?.title,
    "The Named Game",
    "the catalog name beats the sandboxName",
  );
  assert.equal(
    result.games[0]?.appName,
    "Libprimary",
    "Epic's own install app name, not a guessed hash",
  );
});
