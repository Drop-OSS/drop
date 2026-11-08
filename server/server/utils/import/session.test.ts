import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openImportSession,
  storeImportedObject,
  commitImportSession,
  cancelImportSession,
  requireImportSession,
  importSessionSummary,
  type ImportDatabase,
} from "./session";
import { publishDirectoryToCas } from "../depot/publish";
import { parseDropletManifest } from "../depot/manifest";
import { casObjectPath } from "../depot/paths";
import type { DropletManifest } from "../depot/manifest";

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function freshRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "gd-import-"));
}

/** Chunk a buffer exactly like the client must: fixed blocks, only the tail short. */
function clientChunks(data: Buffer) {
  const chunks: Array<{ size: number; sha256: string }> = [];
  for (let offset = 0; offset < data.length; offset += 4 * 1024 * 1024) {
    const part = data.subarray(offset, offset + 4 * 1024 * 1024);
    chunks.push({ size: part.length, sha256: sha(part) });
  }
  return chunks;
}

function fakeDb() {
  const created = {
    games: [] as Array<{ title: string; digest: string }>,
    versions: [] as Array<{
      gameId: string;
      displayName: string;
      manifest: DropletManifest;
      casManifestDigest: string;
      fileList: string[];
      versionIndex: number;
      runsStandalone: boolean;
    }>,
  };
  const db: ImportDatabase = {
    async findGame(id) {
      return id === "game-1" ? { id, name: "Existing" } : null;
    },
    async createImportedGame({ title, digest }) {
      created.games.push({ title, digest });
      return `game-${created.games.length}`;
    },
    async nextVersionIndex() {
      return created.versions.length;
    },
    async createImportedVersion(input) {
      created.versions.push(input);
      return `version-${created.versions.length}`;
    },
  };
  return { db, created };
}

async function uploadAll(
  root: string,
  session: Awaited<ReturnType<typeof openImportSession>>["session"],
  data: Map<string, Buffer>,
) {
  for (const digest of session.missing) {
    const bytes = data.get(digest);
    if (!bytes) continue;
    await storeImportedObject(
      root,
      session,
      digest,
      (async function* () {
        yield bytes;
      })(),
    );
  }
}

function filesOf(tree: Map<string, { data: Buffer; mode?: number }>) {
  return [...tree.entries()].map(([path, { data, mode }]) => ({
    path,
    size: data.length,
    ...(mode !== undefined ? { mode } : {}),
    sha256: sha(data),
    chunks: clientChunks(data),
  }));
}

test("an imported release digests exactly like the same tree published from disk", async () => {
  const source = await mkdtemp(join(tmpdir(), "gd-import-src-"));
  const root = await freshRoot();
  const tree = new Map([
    [
      "game.exe",
      {
        data: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(5000, 7)]),
        mode: 0o755,
      },
    ],
    ["data/readme.txt", { data: Buffer.from("hello depot\n") }],
    ["data/empty.dat", { data: Buffer.alloc(0) }],
  ]);
  for (const [path, { data, mode }] of tree) {
    const target = join(source, path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, data, { mode: mode ?? 0o644 });
  }
  const disk = await publishDirectoryToCas({
    sourceDir: source,
    depotRoot: root,
  });

  const { db } = fakeDb();
  const opened = await openImportSession(
    root,
    { gameTitle: "Parity Test", files: filesOf(tree) },
    db,
  );
  assert.equal(opened.digest, disk.digest);
  assert.equal(
    opened.missing.length,
    0,
    "the disk publish stored every object already",
  );

  const result = await commitImportSession(root, opened.session, db);
  assert.equal(result.digest, disk.digest);
});

test("open rejects unsafe, duplicate, and inconsistent declarations", async () => {
  const root = await freshRoot();
  const { db } = fakeDb();
  const good = Buffer.from("payload");
  const base = {
    path: "ok.bin",
    size: good.length,
    sha256: sha(good),
    chunks: clientChunks(good),
  };
  const reject = async (file: Record<string, unknown>, _message: string) => {
    await assert.rejects(
      openImportSession(root, { gameTitle: "X", files: [file as never] }, db),
      (error: unknown) => (error as { statusCode?: number }).statusCode === 400,
    );
  };
  await reject({ ...base, path: "../escape" }, "traversal");
  await reject({ ...base, sha256: "nope" }, "file digest");
  await reject(
    { ...base, chunks: [{ size: good.length + 1, sha256: base.sha256 }] },
    "chunk coverage",
  );
  await reject(
    { ...base, chunks: [{ size: good.length, sha256: "bad" }] },
    "chunk digest",
  );
  await reject({ ...base, size: good.length + 5 }, "size coverage");
  await assert.rejects(
    openImportSession(root, { gameTitle: "X", files: [base, { ...base }] }, db),
    /Duplicate import path/,
  );
  await assert.rejects(
    openImportSession(root, { gameTitle: " ", files: [base] }, db),
    /gameTitle/,
  );
});

test("a full upload verifies arriving bytes and commits a release", async () => {
  const root = await freshRoot();
  const { db, created } = fakeDb();
  const a = Buffer.from("alpha bytes".repeat(100));
  const b = Buffer.from("beta bytes".repeat(100));
  const tree = new Map([
    ["game.exe", { data: a, mode: 0o755 }],
    ["sub/b.bin", { data: b }],
  ]);
  const opened = await openImportSession(
    root,
    {
      gameTitle: "Own Files",
      appVersion: "1.2.3",
      device: "deck",
      importer: "admin-1",
      files: filesOf(tree),
    },
    db,
  );
  assert.equal(opened.missing.length, 2);
  const data = new Map([
    [sha(a), a],
    [sha(b), b],
  ]);

  // Wrong bytes for a declared digest must fail and store nothing.
  await assert.rejects(
    storeImportedObject(
      root,
      opened.session,
      sha(a),
      (async function* () {
        yield Buffer.from("tampered");
      })(),
    ),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 422,
  );
  await assert.rejects(readFile(casObjectPath(root, sha(a)), "utf8"));

  await uploadAll(root, opened.session, data);
  assert.equal(importSessionSummary(opened.session).missingObjects, 0);

  const result = await commitImportSession(root, opened.session, db);
  assert.equal(result.digest, opened.digest);
  assert.equal(result.fileCount, 2);
  assert.equal(result.chunkCount, 2);

  const manifest = parseDropletManifest(
    await readFile(join(root, "manifests", `${result.digest}.json`), "utf8"),
  );
  assert.equal(manifest.digest, result.digest);
  assert.equal(
    manifest.files[0]?.mode,
    0o755,
    "the executable bit survives import",
  );

  const meta = JSON.parse(
    await readFile(
      join(root, "manifests", `${result.digest}.meta.json`),
      "utf8",
    ),
  );
  assert.equal(meta.source, "local-import");
  assert.equal(meta.importer, "admin-1");
  assert.equal(meta.device, "deck");

  assert.equal(created.games.length, 1);
  assert.equal(created.games[0]?.title, "Own Files");
  assert.equal(created.versions[0]?.casManifestDigest, result.digest);
  assert.deepEqual(created.versions[0]?.fileList, ["game.exe", "sub/b.bin"]);
  assert.equal(created.versions[0]?.displayName, "1.2.3");
  assert.equal(
    created.versions[0]?.runsStandalone,
    true,
    "an import that says nothing is self-starting",
  );

  // A committed session is closed for further traffic.
  await assert.rejects(
    commitImportSession(root, opened.session, db),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 409,
  );
});

test("a session declared launcher-gated publishes that version as such", async () => {
  const root = await freshRoot();
  const { db, created } = fakeDb();
  const data = Buffer.from("gated build bytes");
  const tree = new Map([["game.exe", { data, mode: 0o755 }]]);
  const opened = await openImportSession(
    root,
    {
      gameTitle: "Launcher Gated",
      runsStandalone: false,
      files: filesOf(tree),
    },
    db,
  );
  await uploadAll(root, opened.session, new Map([[sha(data), data]]));
  await commitImportSession(root, opened.session, db);

  assert.equal(created.versions[0]?.runsStandalone, false);
});

test("dedupe: identical content across files uploads once and repeats dedupe", async () => {
  const root = await freshRoot();
  const { db } = fakeDb();
  const shared = Buffer.from("twins");
  const tree = new Map([
    ["one.bin", { data: shared }],
    ["two.bin", { data: shared }],
  ]);
  const opened = await openImportSession(
    root,
    { gameTitle: "Twins", files: filesOf(tree) },
    db,
  );
  assert.equal(
    opened.totalObjects,
    1,
    "same chunk declared twice is one object",
  );
  await storeImportedObject(
    root,
    opened.session,
    sha(shared),
    (async function* () {
      yield shared;
    })(),
  );
  const again = await storeImportedObject(
    root,
    opened.session,
    sha(shared),
    (async function* () {
      yield shared;
    })(),
  );
  assert.deepEqual(again, { stored: false, deduped: true });
  const result = await commitImportSession(root, opened.session, db);
  assert.equal(result.chunkCount, 1);
});

test("commit refuses while objects are missing; cancel closes the session", async () => {
  const root = await freshRoot();
  const { db } = fakeDb();
  const a = Buffer.from("need");
  const b = Buffer.from("also-need");
  const tree = new Map([
    ["a.bin", { data: a }],
    ["b.bin", { data: b }],
  ]);
  const opened = await openImportSession(
    root,
    { gameTitle: "Partial", files: filesOf(tree) },
    db,
  );
  await assert.rejects(
    commitImportSession(root, opened.session, db),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 409,
  );
  await storeImportedObject(
    root,
    opened.session,
    sha(a),
    (async function* () {
      yield a;
    })(),
  );
  cancelImportSession(opened.session);
  assert.throws(() => requireImportSession(opened.session.id));
  await assert.rejects(
    storeImportedObject(
      root,
      opened.session,
      sha(b),
      (async function* () {
        yield b;
      })(),
    ),
  );
});

test("an existing gameId links the release instead of creating a game", async () => {
  const root = await freshRoot();
  const { db, created } = fakeDb();
  const data = Buffer.from("linked");
  const opened = await openImportSession(
    root,
    {
      gameTitle: "Linked",
      gameId: "game-1",
      files: filesOf(new Map([["f.bin", { data }]])),
    },
    db,
  );
  await uploadAll(root, opened.session, new Map([[sha(data), data]]));
  const result = await commitImportSession(root, opened.session, db);
  assert.equal(result.gameId, "game-1");
  assert.equal(created.games.length, 0);
});

test("unknown gameId is refused at open, before any byte moves", async () => {
  const root = await freshRoot();
  const { db } = fakeDb();
  const data = Buffer.from("x");
  await assert.rejects(
    openImportSession(
      root,
      {
        gameTitle: "Ghost",
        gameId: "gone",
        files: filesOf(new Map([["f.bin", { data }]])),
      },
      db,
    ),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 404,
  );
});

test("a re-import of unchanged content opens with nothing missing and republishes the same digest", async () => {
  const root = await freshRoot();
  const { db } = fakeDb();
  const data = Buffer.from("stable release".repeat(1000));
  const tree = new Map([["big.bin", { data }]]);
  const first = await openImportSession(
    root,
    { gameTitle: "Stable", files: filesOf(tree) },
    db,
  );
  await uploadAll(root, first.session, new Map([[sha(data), data]]));
  const firstResult = await commitImportSession(root, first.session, db);

  const second = await openImportSession(
    root,
    { gameTitle: "Stable", appVersion: "resync", files: filesOf(tree) },
    db,
  );
  assert.equal(second.missing.length, 0, "an unchanged resync uploads nothing");
  const secondResult = await commitImportSession(root, second.session, db);
  assert.equal(secondResult.digest, firstResult.digest);
});
