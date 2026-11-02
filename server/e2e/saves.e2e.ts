/**
 * End-to-end drive of the versioned save service against real infrastructure:
 * a real PostgreSQL, the real filesystem object backend, and the real
 * `SaveManager`. The unit tests next to the modules cover the pure decisions
 * (content hashing, retention, the sync decision); this covers everything that
 * only shows up with a database and an object store underneath it - the
 * optimistic head swap, the idempotency replay, archive dedupe, pruning plus
 * reference-counted garbage collection, and restore.
 *
 *   DATABASE_URL=postgresql://... /data> pnpm e2e:saves
 *
 * It refuses to run against anything that does not look like a scratch
 * database, because it creates and deletes rows and object files.
 */
import "./nitro-stubs";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { canonicalize } from "json-canonicalize";
import prisma from "~/server/internal/db/database";
import profileManager from "~/server/internal/profiles";
import saveManager from "~/server/internal/saves";
import { SaveConflictError } from "~/server/internal/saves/errors";
import { contentHash } from "~/server/internal/saves/hash";
import {
  ClientCapabilities,
  Platform,
  SaveVersionKind,
} from "~/prisma/client/enums";

const databaseUrl = process.env.DATABASE_URL ?? "";
const databaseName = new URL(databaseUrl || "http://invalid").pathname ?? "";
if (!process.env.E2E_ALLOW_DB && !/(e2e|test|scratch)/i.test(databaseName)) {
  console.error(
    `refusing to run: DATABASE_URL points at '${databaseName}'.\n` +
      `Point it at a scratch database (name containing e2e/test/scratch).`,
  );
  process.exit(1);
}

const objectDir = join(
  process.env.DATA ?? "./.data/data",
  "objects",
  "objects",
);

const results: Array<{ name: string; error?: string }> = [];

function file(objectId: string): string {
  return join(objectDir, objectId);
}

function archive(files: Array<{ key: string; body: string }>) {
  // Any byte blob will do: the server never opens the archive, it stores and
  // hashes it. The content hash is what the client would compute over `files`.
  const bytes = Buffer.from(
    files.map((f) => `${f.key}\u0000${f.body}`).join("\u0001"),
    "utf8",
  );
  const digest = contentHash(
    files.map((f) => ({
      key: f.key,
      size: Buffer.byteLength(f.body),
      sha256: createHash("sha256").update(f.body).digest("hex"),
    })),
  );
  return {
    bytes,
    contentHash: digest,
    archiveSha256: createHash("sha256").update(bytes).digest("hex"),
    stream: () => Readable.from(bytes) as unknown as IncomingMessage,
  };
}

function status(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? (error as { statusCode?: number }).statusCode
    : undefined;
}

async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    results.push({ name });
    console.log(`  ok   ${name}`);
  } catch (error) {
    results.push({ name, error: (error as Error).message });
    console.log(`  FAIL ${name}\n       ${(error as Error).message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, what: string) {
  if (actual !== expected)
    throw new Error(
      `${what}: expected ${String(expected)}, got ${String(actual)}`,
    );
}

async function main() {
  const userId = randomUUID();
  const clientId = randomUUID();
  const libraryId = randomUUID();
  const gameId = randomUUID();
  const manifestGameId = randomUUID();

  console.log(`database: ${databaseName || "?"}`);
  console.log(`objects:  ${objectDir}\n`);

  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        username: "e2e-saves",
        displayName: "E2E Saves",
        email: "e2e-saves@example.invalid",
        profilePictureObjectId: "",
      },
    }),
    prisma.library.create({
      data: { id: libraryId, name: "E2E", backend: "Filesystem", options: {} },
    }),
    prisma.game.create({
      data: {
        id: gameId,
        metadataSource: "Manual",
        metadataId: `e2e-${gameId}`,
        mName: "E2E Save Game",
        mShortDescription: "e2e",
        mDescription: "e2e",
        mReleased: new Date(0),
        mIconObjectId: "",
        mBannerObjectId: "",
        mCoverObjectId: "",
        mImageCarouselObjectIds: [],
        mImageLibraryObjectIds: [],
        libraryId,
        libraryPath: "e2e-saves",
      },
    }),
    prisma.game.create({
      data: {
        id: manifestGameId,
        metadataSource: "Manual",
        metadataId: `e2e-${manifestGameId}`,
        mName: "E2E Manifest Game",
        mShortDescription: "e2e",
        mDescription: "e2e",
        mReleased: new Date(0),
        mIconObjectId: "",
        mBannerObjectId: "",
        mCoverObjectId: "",
        mImageCarouselObjectIds: [],
        mImageLibraryObjectIds: [],
        libraryId,
        libraryPath: "e2e",
      },
    }),
    prisma.client.create({
      data: {
        id: clientId,
        userId,
        name: "e2e-saves",
        platform: Platform.Linux,
        capabilities: [ClientCapabilities.CloudSaves],
        lastConnected: new Date(),
      },
    }),
  ]);

  // Everything a player owns hangs off their profile; asking for the
  // default also proves it self-heals for a brand-new account.
  const profile = await profileManager.defaultProfile(userId);

  const base = { userId, profileId: profile.id, gameId, index: 0, clientId };
  const uploaded: Array<{ id: string; objectId: string; contentHash: string }> =
    [];

  await check(
    "first backup creates the auto slot and becomes the head",
    async () => {
      const save = archive([{ key: "save/slot1.sav", body: "one" }]);
      const version = await saveManager.createVersion({
        ...base,
        stream: save.stream(),
        baseVersionId: null,
        contentHash: save.contentHash,
        archiveSha256: save.archiveSha256,
        declaredSize: save.bytes.length,
        fileCount: 1,
        manifestHash: null,
        clientMutationId: null,
        kind: SaveVersionKind.Backup,
      });
      uploaded.push(version);
      assert(existsSync(file(version.objectId)), "archive object never landed");
      const slot = await saveManager.getSlot(userId, profile.id, gameId, 0);
      equal(slot.head?.id, version.id, "slot head");
      equal(slot.versionCount, 1, "version count");
    },
  );

  await check(
    "a backup on top of the current head moves the head",
    async () => {
      const save = archive([{ key: "save/slot1.sav", body: "two" }]);
      const version = await saveManager.createVersion({
        ...base,
        stream: save.stream(),
        baseVersionId: uploaded[0]!.id,
        contentHash: save.contentHash,
        archiveSha256: save.archiveSha256,
        declaredSize: save.bytes.length,
        fileCount: 1,
        manifestHash: null,
        clientMutationId: null,
        kind: SaveVersionKind.Backup,
      });
      uploaded.push(version);
      const slot = await saveManager.getSlot(userId, profile.id, gameId, 0);
      equal(slot.head?.id, version.id, "slot head");
      equal(version.parentVersionId, uploaded[0]!.id, "parent version");
    },
  );

  await check(
    "a backup carrying a stale baseline conflicts and names the head",
    async () => {
      const save = archive([{ key: "save/slot1.sav", body: "lost" }]);
      let seen: unknown;
      try {
        await saveManager.createVersion({
          ...base,
          stream: save.stream(),
          baseVersionId: uploaded[0]!.id,
          contentHash: save.contentHash,
          archiveSha256: save.archiveSha256,
          declaredSize: save.bytes.length,
          fileCount: 1,
          manifestHash: null,
          clientMutationId: null,
          kind: SaveVersionKind.Backup,
        });
      } catch (error) {
        seen = error;
      }
      assert(seen instanceof SaveConflictError, "expected SaveConflictError");
      equal(
        (seen as SaveConflictError).headVersionId,
        uploaded[1]!.id,
        "conflict head",
      );
      const slot = await saveManager.getSlot(userId, profile.id, gameId, 0);
      equal(slot.versionCount, 2, "version count after a rejected write");
      assert(
        (await prisma.saveVersion.count({ where: { userId } })) === 2,
        "the rejected upload left a version row",
      );
      assert(
        !existsSync(file(save.archiveSha256)),
        "the rejected upload left its object behind",
      );
    },
  );

  await check(
    "replaying an Idempotency-Key returns the version that won",
    async () => {
      const mutation = randomUUID();
      const save = archive([{ key: "save/slot1.sav", body: "three" }]);
      const input = {
        ...base,
        baseVersionId: uploaded[1]!.id,
        contentHash: save.contentHash,
        archiveSha256: save.archiveSha256,
        declaredSize: save.bytes.length,
        fileCount: 1,
        manifestHash: null,
        clientMutationId: mutation,
        kind: SaveVersionKind.Backup,
      };
      const first = await saveManager.createVersion({
        ...input,
        stream: save.stream(),
      });
      uploaded.push(first);
      const replay = await saveManager.createVersion({
        ...input,
        stream: archive([{ key: "save/slot1.sav", body: "three" }]).stream(),
      });
      equal(replay.id, first.id, "replayed version id");
      const slot = await saveManager.getSlot(userId, profile.id, gameId, 0);
      equal(slot.versionCount, 3, "version count after replay");
    },
  );

  await check("identical archive bytes reuse the stored object", async () => {
    const save = archive([{ key: "save/slot1.sav", body: "two" }]);
    const twin = await saveManager.createVersion({
      ...base,
      stream: save.stream(),
      baseVersionId: uploaded[2]!.id,
      contentHash: save.contentHash,
      archiveSha256: save.archiveSha256,
      declaredSize: save.bytes.length,
      fileCount: 1,
      manifestHash: null,
      clientMutationId: null,
      kind: SaveVersionKind.Backup,
    });
    uploaded.push(twin);
    equal(twin.objectId, uploaded[1]!.objectId, "shared object id");
    equal(twin.id === uploaded[1]!.id, false, "dedupe must still version");
  });

  await check("the sync decision answers every device state", async () => {
    const head = (await saveManager.getSlot(userId, profile.id, gameId, 0)).head!;
    // A version older than the head whose content also differs from it: the
    // only baseline that can tell "pull" from "converged".
    const stale = await prisma.saveVersion.findFirst({
      where: {
        userId,
        gameId,
        slotIndex: 0,
        id: { not: head.id },
        contentHash: { not: head.contentHash },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    assert(stale !== null, "no divergent older version to test against");

    const other = contentHash([
      {
        key: "save/slot1.sav",
        size: 5,
        sha256: createHash("sha256").update("other").digest("hex"),
      },
    ]);

    const cases: Array<
      [string, Parameters<typeof saveManager.syncState>[4], string]
    > = [
      [
        "device matches the server",
        { baseVersionId: head.id, localContentHash: head.contentHash },
        "converged",
      ],
      [
        "device edited, server still on its baseline",
        { baseVersionId: head.id, localContentHash: other },
        "push",
      ],
      [
        "device untouched, server moved",
        { baseVersionId: stale!.id, localContentHash: stale!.contentHash },
        "pull",
      ],
      [
        "both moved",
        { baseVersionId: stale!.id, localContentHash: other },
        "conflict",
      ],
      [
        "device edited into exactly what the server holds",
        { baseVersionId: stale!.id, localContentHash: head.contentHash },
        "converged",
      ],
      [
        "fresh device with nothing local",
        { baseVersionId: null, localContentHash: null },
        "pull",
      ],
    ];
    for (const [name, state, expected] of cases) {
      const seen = await saveManager.syncState(userId, profile.id, gameId, 0, state);
      equal(seen.decision, expected, `sync decision (${name})`);
    }
  });

  await check(
    "the version timeline pages without gaps or repeats",
    async () => {
      const pageOne = await saveManager.listVersions(userId, profile.id, gameId, 0, {
        limit: 2,
      });
      equal(pageOne.length, 2, "first page size");
      const pageTwo = await saveManager.listVersions(userId, profile.id, gameId, 0, {
        limit: 2,
        cursor: pageOne.at(-1)!.id,
      });
      const ids = [...pageOne, ...pageTwo].map((v) => v.id);
      equal(new Set(ids).size, ids.length, "cursor repeated a version");
      let seen: unknown;
      try {
        await saveManager.listVersions(userId, profile.id, gameId, 0, {
          cursor: randomUUID(),
        });
      } catch (error) {
        seen = error;
      }
      equal(status(seen), 400, "unknown cursor status");
    },
  );

  await check(
    "restore publishes a new version and keeps the version it came from",
    async () => {
      const before = (await saveManager.getSlot(userId, profile.id, gameId, 0)).head!;
      const target = await prisma.saveVersion.findFirst({
        where: { userId, gameId, slotIndex: 0, id: { not: before.id } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      assert(target !== null, "no older version to restore");
      // Retention runs on every write, so pin it: what a user rolls back to has
      // to survive the history limit.
      await saveManager.setPinned(userId, profile.id, gameId, 0, target!.id, false);
      await saveManager.setPinned(userId, profile.id, gameId, 0, target!.id, true);

      const restored = await saveManager.restoreVersion(
        userId,
        profile.id,
        gameId,
        0,
        target!.id,
        before.id,
        clientId,
      );
      equal(restored.kind, SaveVersionKind.Restore, "restored kind");
      equal(restored.restoredFromVersionId, target!.id, "restored from");
      equal(restored.contentHash, target!.contentHash, "restored content");
      equal(restored.objectId, target!.objectId, "restored object reuse");
      const after = await saveManager.getSlot(userId, profile.id, gameId, 0);
      equal(after.head?.id, restored.id, "head after restore");
      equal(
        await prisma.saveVersion.count({ where: { id: target!.id } }),
        1,
        "pinned source pruned away",
      );
      assert(
        after.versionCount <= 4,
        `history kept ${after.versionCount} versions past its limit`,
      );
      uploaded.push({
        id: restored.id,
        objectId: restored.objectId,
        contentHash: restored.contentHash,
      });
    },
  );

  await check("the head version cannot be deleted", async () => {
    const head = (await saveManager.getSlot(userId, profile.id, gameId, 0)).head!;
    let seen: unknown;
    try {
      await saveManager.deleteVersion(userId, profile.id, gameId, 0, head.id);
    } catch (error) {
      seen = error;
    }
    equal(status(seen), 400, "delete-head status");
  });

  await check(
    "pruning keeps head and pinned, and frees exactly the objects nothing points at",
    async () => {
      const head0 = (await saveManager.getSlot(userId, profile.id, gameId, 0)).head!;
      const keep = await prisma.saveVersion.findFirst({
        where: { userId, gameId, slotIndex: 0, id: { not: head0.id } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      assert(keep !== null, "nothing to pin");
      const pinFlagged = await saveManager.setPinned(
        userId,
        profile.id,
        gameId,
        0,
        keep!.id,
        true,
      );
      equal(pinFlagged.pinned, true, "pin flag");

      const objects = await prisma.saveVersion.findMany({
        where: { userId },
        select: { objectId: true },
      });

      // saveSlotHistoryLimit defaults to 3, so this pushes well past it.
      for (let i = 0; i < 6; i++) {
        const save = archive([{ key: "save/slot1.sav", body: `filler-${i}` }]);
        const head = (await saveManager.getSlot(userId, profile.id, gameId, 0)).head!;
        await saveManager.createVersion({
          ...base,
          stream: save.stream(),
          baseVersionId: head.id,
          contentHash: save.contentHash,
          archiveSha256: save.archiveSha256,
          declaredSize: save.bytes.length,
          fileCount: 1,
          manifestHash: null,
          clientMutationId: null,
          kind: SaveVersionKind.Backup,
        });
      }

      const remaining = await prisma.saveVersion.findMany({
        where: { userId, gameId, slotIndex: 0 },
        select: { id: true, objectId: true, pinned: true },
      });
      const remainingIds = new Set(remaining.map((v) => v.id));
      const head = (await saveManager.getSlot(userId, profile.id, gameId, 0)).head!;
      assert(remainingIds.has(head.id), "pruning removed the head");
      assert(remainingIds.has(keep!.id), "pruning removed a pinned version");
      assert(remaining.length <= 4, `prune kept ${remaining.length} versions`);

      // GC contract: an object on disk iff some version still points at it.
      const seen = new Set<string>();
      for (const objectId of [
        ...objects.map((v) => v.objectId),
        ...remaining.map((v) => v.objectId),
      ]) {
        if (seen.has(objectId)) continue;
        seen.add(objectId);
        const references = await prisma.saveVersion.count({
          where: { objectId },
        });
        if (references === 0)
          assert(
            !existsSync(file(objectId)),
            `pruned object ${objectId} is still on disk`,
          );
        else
          assert(
            existsSync(file(objectId)),
            `object ${objectId} has ${references} version(s) but no bytes`,
          );
      }
    },
  );

  await check(
    "a download returns exactly the bytes that were stored",
    async () => {
      const head = (await saveManager.getSlot(userId, profile.id, gameId, 0)).head!;
      const { data } = await saveManager.downloadVersion(
        userId,
        profile.id,
        gameId,
        0,
        head.id,
      );
      const chunks: Buffer[] = [];
      for await (const chunk of data as AsyncIterable<Buffer>)
        chunks.push(chunk);
      const body = Buffer.concat(chunks);
      equal(
        createHash("sha256").update(body).digest("hex"),
        head.archiveSha256,
        "downloaded archive hash",
      );
    },
  );

  await check("the legacy push keeps last-write-wins semantics", async () => {
    const save = archive([{ key: "save/slot1.sav", body: "legacy" }]);
    await saveManager.pushSave(
      gameId,
      userId,
      profile.id,
      0,
      save.stream(),
      clientId,
    );
    const head = (await saveManager.getSlot(userId, profile.id, gameId, 0)).head!;
    equal(head.kind, SaveVersionKind.Backup, "legacy push kind");
    assert(
      JSON.stringify(head.metadata).includes("legacyPush"),
      "legacy push not tagged",
    );
    uploaded.push({
      id: head.id,
      objectId: head.objectId,
      contentHash: head.contentHash,
    });
  });

  await check(
    "the manifest read is hashed and absent manifests say 404",
    async () => {
      const entry = {
        files: { "<winDocuments>/E2E/save": { tags: ["save"] } },
        installDir: { E2E: {} },
      };
      await prisma.saveManifest.create({
        data: {
          gameId: manifestGameId,
          entry,
          source: "curated",
          ludusaviName: "E2E",
        },
      });
      const seen = await saveManager.manifestForGame(manifestGameId);
      equal(
        seen.entryHash,
        createHash("sha256").update(canonicalize(entry)).digest("hex"),
        "manifest entry hash",
      );
      let missing: unknown;
      try {
        await saveManager.manifestForGame(gameId);
      } catch (error) {
        missing = error;
      }
      equal(status(missing), 404, "missing manifest status");
    },
  );

  await check(
    "deleting a slot takes its history and objects with it",
    async () => {
      const objects = (
        await prisma.saveVersion.findMany({
          where: { userId, gameId, slotIndex: 0 },
          select: { objectId: true },
        })
      ).map((v) => v.objectId);
      await saveManager.deleteSlot(userId, profile.id, gameId, 0);
      equal(
        await prisma.saveVersion.count({ where: { userId } }),
        0,
        "versions left",
      );
      equal(
        await prisma.saveSlot.count({ where: { userId } }),
        0,
        "slots left",
      );
      for (const objectId of objects)
        assert(
          !existsSync(file(objectId)) ||
            (await prisma.saveVersion.count({ where: { objectId } })) > 0,
          `object ${objectId} leaked`,
        );
    },
  );

  await check(
    "slots follow the count limit and hand out the lowest free index",
    async () => {
      // Slot 0 is free again (the previous check deleted it), so the next slot
      // must be 0 rather than highest-plus-one.
      const first = await saveManager.createNextSlot(
        userId,
        profile.id,
        gameId,
        null,
        clientId,
      );
      equal(first.index, 0, "createNextSlot index");
      const second = await saveManager.createNextSlot(
        userId,
        profile.id,
        gameId,
        "cloud save slot label ".repeat(8),
        clientId,
      );
      equal(second.index, 1, "second slot index");
      equal(second.label?.length, 100, "label truncated to 100 characters");

      while ((await prisma.saveSlot.count({ where: { userId, gameId } })) < 5)
        await saveManager.createNextSlot(userId, profile.id, gameId, null, clientId);

      let overLimit: unknown;
      try {
        await saveManager.createNextSlot(userId, profile.id, gameId, null, clientId);
      } catch (error) {
        overLimit = error;
      }
      equal(status(overLimit), 400, "over-limit status");

      let clash: unknown;
      try {
        await saveManager.createSlot(userId, profile.id, gameId, 0, null, clientId);
      } catch (error) {
        clash = error;
      }
      equal(status(clash), 409, "duplicate slot status");
    },
  );

  await check(
    "only slot 0 auto-creates, and a refused upload leaves nothing behind",
    async () => {
      const save = archive([{ key: "save/other.sav", body: "auto" }]);
      let orphan: unknown;
      try {
        await saveManager.createVersion({
          ...base,
          index: 7,
          stream: save.stream(),
          baseVersionId: null,
          contentHash: save.contentHash,
          archiveSha256: save.archiveSha256,
          declaredSize: save.bytes.length,
          fileCount: 1,
          manifestHash: null,
          clientMutationId: null,
          kind: SaveVersionKind.Backup,
        });
      } catch (error) {
        orphan = error;
      }
      equal(status(orphan), 404, "missing non-zero slot status");

      // saveSlotSizeLimit defaults to 10 MB; slot 0 is empty, so "no baseline" is
      // the right If-Match here.
      const big = Buffer.alloc(11 * 1024 * 1024, 7);
      let oversize: unknown;
      try {
        await saveManager.createVersion({
          ...base,
          stream: Readable.from(big) as unknown as IncomingMessage,
          baseVersionId: null,
          contentHash: null,
          archiveSha256: null,
          declaredSize: big.length,
          fileCount: null,
          manifestHash: null,
          clientMutationId: null,
          kind: SaveVersionKind.Backup,
        });
      } catch (error) {
        oversize = error;
      }
      equal(status(oversize), 413, "oversize upload status");

      const declared = archive([
        { key: "save/other.sav", body: "declared too big" },
      ]);
      let declaredBig: unknown;
      try {
        await saveManager.createVersion({
          ...base,
          stream: declared.stream(),
          baseVersionId: null,
          contentHash: declared.contentHash,
          archiveSha256: declared.archiveSha256,
          declaredSize: 11 * 1024 * 1024,
          fileCount: 1,
          manifestHash: null,
          clientMutationId: null,
          kind: SaveVersionKind.Backup,
        });
      } catch (error) {
        declaredBig = error;
      }
      equal(status(declaredBig), 413, "declared-size status");

      const mismatched = archive([
        { key: "save/other.sav", body: "checksum lies" },
      ]);
      let lying: unknown;
      try {
        await saveManager.createVersion({
          ...base,
          stream: mismatched.stream(),
          baseVersionId: null,
          contentHash: mismatched.contentHash,
          archiveSha256: createHash("sha256")
            .update("not the archive")
            .digest("hex"),
          declaredSize: mismatched.bytes.length,
          fileCount: 1,
          manifestHash: null,
          clientMutationId: null,
          kind: SaveVersionKind.Backup,
        });
      } catch (error) {
        lying = error;
      }
      equal(status(lying), 400, "archive checksum mismatch status");

      const slot = await saveManager.getSlot(userId, profile.id, gameId, 0);
      equal(slot.head, null, "head after refused uploads");
      equal(slot.versionCount, 0, "versions after refused uploads");

      const created = await saveManager.createVersion({
        ...base,
        stream: save.stream(),
        baseVersionId: null,
        contentHash: save.contentHash,
        archiveSha256: save.archiveSha256,
        declaredSize: save.bytes.length,
        fileCount: 1,
        manifestHash: null,
        clientMutationId: null,
        kind: SaveVersionKind.Backup,
      });
      const after = await saveManager.getSlot(userId, profile.id, gameId, 0);
      equal(after.head?.id, created.id, "head after a good upload");
    },
  );

  await prisma.saveSlot.deleteMany({ where: { userId } });
  await prisma.saveManifest.deleteMany({ where: { gameId: manifestGameId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.game.deleteMany({
    where: { id: { in: [gameId, manifestGameId] } },
  });
  await prisma.library.deleteMany({ where: { id: libraryId } });
  await prisma.user.deleteMany({ where: { id: userId } });

  const failed = results.filter((r) => r.error);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`,
  );
  await prisma.$disconnect();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
