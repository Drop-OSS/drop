import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { H3Event } from "h3";
import { eaLibraryHandler } from "./library.get";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function event(url: string, headers: Record<string, string> = {}) {
  return new H3Event({ url, headers, method: "GET" } as never, {} as never);
}

test("rejects requests without a token", async () => {
  await assert.rejects(
    () => eaLibraryHandler(event("/api/admin/depot/ea/library")),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 401,
  );
});

test("returns owned games when a token is supplied", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          entitlementInfo: {
            offerId: "o1",
            baseGames: [{ id: "b1", name: "A" }],
          },
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  const result = (await eaLibraryHandler(
    event("/api/admin/depot/ea/library?token=abc"),
  )) as { games: unknown[]; total: number };
  assert.equal(result.total, 1);
});
