import test from "node:test";
import assert from "node:assert/strict";
import type { DepotStorageProvider } from "../../../plugins/types";
import { readRemoteRange, resolveRemoteDepot } from "../remote";

function provider(
  id: string,
  resolve: DepotStorageProvider["resolveDepotStream"],
): DepotStorageProvider {
  return { id, name: id, resolveDepotStream: resolve };
}

test("resolveRemoteDepot returns the first provider with a usable stream", async () => {
  const providers: DepotStorageProvider[] = [
    provider("empty", async () => null),
    provider("throwing", async () => {
      throw new Error("provider down");
    }),
    provider("hollow", async () => ({})),
    provider("seedbox", async (depotId, gameId) => ({
      url: `https://seed.example/${gameId}/${depotId}`,
      headers: { Authorization: "Bearer t" },
    })),
    provider("later", async () => ({ url: "https://later.example" })),
  ];

  const resolved = await resolveRemoteDepot("game-1", "depot-1", providers);
  assert.equal(resolved?.providerId, "seedbox");
  assert.equal(resolved?.stream.url, "https://seed.example/game-1/depot-1");
  assert.deepEqual(resolved?.stream.headers, { Authorization: "Bearer t" });
});

test("resolveRemoteDepot returns null when no provider can serve the game", async () => {
  const resolved = await resolveRemoteDepot("game-1", "depot-1", [
    provider("empty", async () => null),
    provider("throwing", async () => {
      throw new Error("down");
    }),
  ]);
  assert.equal(resolved, null);
});

test("readRemoteRange delegates to pieceReader when present", async () => {
  const calls: Array<[number, number]> = [];
  const data = await readRemoteRange(
    {
      pieceReader: async (offset, length) => {
        calls.push([offset, length]);
        return new Uint8Array([offset, length]);
      },
    },
    10,
    4,
  );
  assert.deepEqual([...data], [10, 4]);
  assert.deepEqual(calls, [[10, 4]]);
});

test("readRemoteRange performs an HTTP range read with provider headers", async () => {
  const originalFetch = globalThis.fetch;
  let seenUrl = "";
  let seenRange: string | null = null;
  let seenAuth: string | null = null;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    seenUrl = String(input);
    const headers = new Headers(init?.headers);
    seenRange = headers.get("Range");
    seenAuth = headers.get("Authorization");
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }) as typeof fetch;

  try {
    const data = await readRemoteRange(
      {
        url: "https://seed.example/stream.bin",
        headers: { Authorization: "Bearer t" },
      },
      100,
      3,
    );
    assert.deepEqual([...data], [1, 2, 3]);
    assert.equal(seenUrl, "https://seed.example/stream.bin");
    assert.equal(seenRange, "bytes=100-102");
    assert.equal(seenAuth, "Bearer t");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("readRemoteRange fails closed on a non-range HTTP response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("nope", { status: 500 })) as typeof fetch;
  try {
    await assert.rejects(
      () => readRemoteRange({ url: "https://seed.example/stream.bin" }, 0, 4),
      /Remote depot read failed \(500\)/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("readRemoteRange validates offsets and missing transports", async () => {
  await assert.rejects(
    () => readRemoteRange({}, 0, 1),
    /neither url nor pieceReader/,
  );
  await assert.rejects(
    () => readRemoteRange({ url: "https://x" }, -1, 1),
    /offset must be a non-negative integer/,
  );
  await assert.rejects(
    () => readRemoteRange({ url: "https://x" }, 0, 0),
    /length must be a positive integer/,
  );
});
