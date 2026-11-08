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
