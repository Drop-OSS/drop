import test from "node:test";
import assert from "node:assert/strict";
import type { StoreScanner } from "../types";
import { collectStoreGames } from "../storeImport";

const steam: StoreScanner = {
  id: "steam",
  name: "Steam",
  store: "steam",
  scan: async () => [
    {
      externalId: "570",
      store: "steam",
      title: "Team Fortress 2",
      installPath: "/games/tf2",
    },
  ],
};

const broken: StoreScanner = {
  id: "epic",
  name: "Epic",
  store: "epic",
  scan: async () => {
    throw new Error("launcher not found");
  },
};

test("collectStoreGames aggregates scanners and records failures", async () => {
  const result = await collectStoreGames([steam, broken]);
  assert.equal(result.games.length, 1);
  assert.equal(result.games[0]?.title, "Team Fortress 2");
  assert.deepEqual(result.failures, [
    { store: "epic", error: "launcher not found" },
  ]);
});

test("collectStoreGames with no scanners returns empty", async () => {
  const result = await collectStoreGames([]);
  assert.deepEqual(result, { games: [], failures: [] });
});
