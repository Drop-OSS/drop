import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isNewerBuild,
  pickLatestGogBuild,
  scanImportedByProvider,
  type ScanDb,
} from "./update-check";

test("a different build identity is an update, an identical one is not", () => {
  assert.equal(isNewerBuild("1.0", "1.1"), true);
  assert.equal(isNewerBuild("1.1", "1.1"), false);
  // Ubisoft names deploys by hex digests, which travel upper-case from the
  // ownership service and lower-case into the version name.
  assert.equal(isNewerBuild("abc123", "ABC123"), false);
  assert.equal(isNewerBuild("abc123", "def456"), true);
});

test("an unknown side never claims an update", () => {
  // The provider answered nothing (legacy product, hidden entitlement):
  // there is nothing to queue.
  assert.equal(isNewerBuild("1.0", null), false);
  assert.equal(isNewerBuild("1.0", undefined), false);
  assert.equal(isNewerBuild("1.0", "  "), false);
  // A game row whose version import never finished still updates when the
  // provider names a build.
  assert.equal(isNewerBuild(null, "1.2"), true);
  assert.equal(isNewerBuild(null, null), false);
});

test("the pick is the newest stable build, by the acquisition's own rule", () => {
  assert.equal(pickLatestGogBuild([]), null);
  // Master first: a listed beta branch must not trigger a re-acquisition
  // the streamer would refuse to land.
  assert.equal(
    pickLatestGogBuild([
      { buildId: "b1", branch: "Beta", versionName: "9.9" },
      { buildId: "b2", branch: "Master", versionName: "1.5" },
      { buildId: "b3", branch: "Master", versionName: "1.4" },
    ]),
    "1.5",
  );
  // An unbracketed entry counts as stable, and a missing versionName falls
  // back to the build id - exactly what the streamer stores as versionPath.
  assert.equal(pickLatestGogBuild([{ buildId: "b9" }]), "b9");
  assert.equal(
    pickLatestGogBuild([{ buildId: "b8", versionName: " 1.6 " }]),
    "1.6",
  );
  // All-beta listings are still an answer: some products ship that way.
  assert.equal(pickLatestGogBuild([{ buildId: "b7", branch: "Beta" }]), "b7");
});

function stubDb(
  games: { id: string; mName: string; metadataId: string }[],
  versions: Record<string, string[]>,
): ScanDb {
  return {
    game: {
      async findMany({ where }) {
        const prefix =
          (where.metadataId as { startsWith: string }).startsWith ?? "";
        return games.filter((g) => g.metadataId.startsWith(prefix));
      },
    },
    gameVersion: {
      async findFirst({ where }) {
        const chain = versions[where.gameId as string] ?? [];
        const newest = chain.at(-1);
        return newest === undefined ? null : { versionPath: newest };
      },
    },
  };
}

test("the scan reads provider ids and newest versions from the catalog", async () => {
  const db = stubDb(
    [
      { id: "g1", mName: "DOOM", metadataId: "gog-1092797371" },
      { id: "g2", mName: "Old Game", metadataId: "gog-123" },
      { id: "g3", mName: "Hand Entry", metadataId: "manual-xyz" },
      { id: "g4", mName: "Ubisoft Game", metadataId: "ubi-563" },
    ],
    { g1: ["1.0", "1.1"], g2: [] },
  );

  const gog = await scanImportedByProvider(db, "gog");
  assert.deepEqual(
    gog.map((r) => [r.productId, r.title, r.latestVersion]),
    [
      ["1092797371", "DOOM", "1.1"],
      ["123", "Old Game", null],
    ],
    "only gog-prefixed rows, newest version each, null for a game with none",
  );

  const ubi = await scanImportedByProvider(db, "ubi");
  assert.deepEqual(
    ubi.map((r) => r.productId),
    ["563"],
    "the ubi scan cannot see the gog rows",
  );
});
