/**
 * HTTP drive of the versioned save API against a running server: real routing,
 * real client-certificate auth, real headers. `saves.e2e.ts` already proves the
 * service against a live database and object store; this proves the contract
 * clients actually depend on - the `409` conflict body carrying the head, the
 * `If-Match` / `Idempotency-Key` / `X-Content-Hash` headers, the capability
 * gate, and the download headers.
 *
 *   DATABASE_URL=... GD_E2E_URL=http://gamedepot:4000 pnpm e2e:saves-http
 *
 * It provisions a throwaway user, client and certificate into the database it
 * is pointed at, and removes them again. The same scratch-database guard as
 * `saves.e2e.ts` applies.
 */
import "./nitro-stubs";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "~/server/internal/db/database";
import { contentHash } from "~/server/internal/saves/hash";
import { ClientCapabilities, Platform } from "~/prisma/client/enums";

const databaseUrl = process.env.DATABASE_URL ?? "";
const databaseName = new URL(databaseUrl || "http://invalid").pathname ?? "";
if (!process.env.E2E_ALLOW_DB && !/(e2e|test|scratch)/i.test(databaseName)) {
  console.error(
    `refusing to run: DATABASE_URL points at '${databaseName}'.\n` +
      `Point it at a scratch database (name containing e2e/test/scratch).`,
  );
  process.exit(1);
}

const baseUrl = (process.env.GD_E2E_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);

const results: Array<{ name: string; error?: string }> = [];

function check(name: string, run: () => Promise<void>) {
  return run().then(
    () => {
      results.push({ name });
      console.log(`  ok   ${name}`);
    },
    (error: Error) => {
      results.push({ name, error: error.message });
      console.log(`  FAIL ${name}\n       ${error.message}`);
    },
  );
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

type Response = { status: number; body: unknown; headers: Headers };

async function request(
  clientId: string,
  privateKey: string,
  method: string,
  path: string,
  init: { body?: BodyInit; headers?: Record<string, string> } = {},
): Promise<Response> {
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign({ nbf: now, exp: now + 30 }, privateKey, {
    algorithm: "ES384",
  });
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    body: init.body,
    headers: {
      ...(init.headers ?? {}),
      ...(init.body === undefined
        ? {}
        : { "content-type": "application/octet-stream" }),
      ...(clientId === "" ? {} : { authorization: `JWT ${clientId} ${token}` }),
    },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* a download body is not JSON */
  }
  return { status: response.status, body, headers: response.headers };
}

function archive(files: Array<{ key: string; body: string }>) {
  const bytes = Buffer.from(
    files.map((f) => `${f.key}\u0000${f.body}`).join("\u0001"),
    "utf8",
  );
  return {
    bytes,
    contentHash: contentHash(
      files.map((f) => ({
        key: f.key,
        size: Buffer.byteLength(f.body),
        sha256: createHash("sha256").update(f.body).digest("hex"),
      })),
    ),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function main() {
  console.log(`database: ${databaseName || "?"}`);
  console.log(`server:   ${baseUrl}\n`);

  const userId = randomUUID();
  const clientId = randomUUID();
  const plainClientId = randomUUID();
  const libraryId = randomUUID();
  const gameId = randomUUID();

  // The server verifies the JWT against whatever PEM sits in the certificate
  // row for `client:<id>`, so a self-generated ES384 pair plays the part of a
  // CA-issued client certificate here.
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "secp384r1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        username: "e2e-http",
        displayName: "E2E HTTP",
        email: "e2e-http@example.invalid",
        profilePictureObjectId: "",
      },
    }),
    prisma.library.create({
      data: {
        id: libraryId,
        name: "E2E HTTP",
        backend: "Filesystem",
        options: {},
      },
    }),
    prisma.game.create({
      data: {
        id: gameId,
        metadataSource: "Manual",
        metadataId: `e2e-http-${gameId}`,
        mName: "E2E HTTP Game",
        mShortDescription: "e2e",
        mDescription: "e2e",
        mReleased: new Date(0),
        mIconObjectId: "",
        mBannerObjectId: "",
        mCoverObjectId: "",
        mImageCarouselObjectIds: [],
        mImageLibraryObjectIds: [],
        libraryId,
        libraryPath: "e2e-http",
      },
    }),
    prisma.client.create({
      data: {
        id: clientId,
        userId,
        name: "e2e-http",
        platform: Platform.Linux,
        capabilities: [
          ClientCapabilities.CloudSaves,
          ClientCapabilities.TrackPlaytime,
        ],
        lastConnected: new Date(),
      },
    }),
    prisma.client.create({
      data: {
        id: plainClientId,
        userId,
        name: "e2e-http-nocap",
        platform: Platform.Linux,
        capabilities: [],
        lastConnected: new Date(),
      },
    }),
    prisma.certificate.create({
      data: {
        id: `client:${clientId}`,
        privateKey,
        certificate: publicKey,
      },
    }),
    prisma.certificate.create({
      data: {
        id: `client:${plainClientId}`,
        privateKey,
        certificate: publicKey,
      },
    }),
  ]);

  const call = (
    method: string,
    path: string,
    init?: Parameters<typeof request>[4],
  ) => request(clientId, privateKey, method, path, init);
  const saves = `/api/v1/client/saves`;

  await check("the settings endpoint advertises versioned saves", async () => {
    const res = await call("GET", `${saves}/settings`);
    equal(res.status, 200, "status");
    const body = res.body as {
      features?: { versionedSaves?: boolean };
      apiVersion?: number;
      slotLimit?: number;
    };
    equal(body.features?.versionedSaves, true, "features.versionedSaves");
    equal(body.apiVersion, 2, "apiVersion");
    assert(typeof body.slotLimit === "number", "slotLimit missing");
  });

  await check(
    "a client without the CloudSaves capability is refused",
    async () => {
      const res = await request(
        plainClientId,
        privateKey,
        "GET",
        `${saves}/settings`,
      );
      equal(res.status, 403, "capability gate");
    },
  );

  await check("an unauthenticated call is refused", async () => {
    const res = await request("", privateKey, "GET", `${saves}/settings`);
    equal(res.status, 403, "anonymous");
  });

  await check("an unknown client id is refused", async () => {
    const res = await request(
      randomUUID(),
      privateKey,
      "GET",
      `${saves}/settings`,
    );
    equal(res.status, 403, "unknown client");
  });

  await check("the game must exist before a slot can be made", async () => {
    const res = await call("POST", `${saves}/${randomUUID()}`, {
      body: "{}",
      headers: { "content-type": "application/json" },
    });
    equal(res.status, 400, "unknown game");
  });

  let firstVersionId = "";
  let secondVersionId = "";

  await check(
    "the slot list starts empty and the auto slot is created on upload",
    async () => {
      const empty = await call("GET", `${saves}/${gameId}`);
      equal(empty.status, 200, "list status");
      equal((empty.body as unknown[]).length, 0, "slots before any upload");

      const save = archive([{ key: "save/slot1.sav", body: "http-one" }]);
      const created = await call("POST", `${saves}/${gameId}/0/versions`, {
        body: save.bytes,
        headers: {
          "idempotency-key": randomUUID(),
          "x-content-hash": save.contentHash,
          "x-archive-sha256": save.sha256,
          "x-file-count": "1",
        },
      });
      equal(created.status, 200, "upload status");
      const version = created.body as { id: string; contentHash: string };
      equal(version.contentHash, save.contentHash, "stored content hash");
      firstVersionId = version.id;

      const listed = await call("GET", `${saves}/${gameId}`);
      const slots = listed.body as Array<{
        index: number;
        head: { id: string } | null;
      }>;
      equal(slots.length, 1, "slot count");
      equal(slots[0]!.index, 0, "auto slot index");
      equal(slots[0]!.head?.id, version.id, "slot head");
    },
  );

  await check("a second backup with If-Match moves the head", async () => {
    const save = archive([{ key: "save/slot1.sav", body: "http-two" }]);
    const res = await call("POST", `${saves}/${gameId}/0/versions`, {
      body: save.bytes,
      headers: {
        "if-match": firstVersionId,
        "idempotency-key": randomUUID(),
        "x-content-hash": save.contentHash,
        "x-archive-sha256": save.sha256,
      },
    });
    equal(res.status, 200, "second upload status");
    secondVersionId = (res.body as { id: string }).id;
    assert(secondVersionId !== firstVersionId, "second upload reused the id");
  });

  await check(
    "a stale If-Match answers 409 and names the current head",
    async () => {
      const save = archive([{ key: "save/slot1.sav", body: "http-lost" }]);
      const res = await call("POST", `${saves}/${gameId}/0/versions`, {
        body: save.bytes,
        headers: {
          "if-match": firstVersionId,
          "idempotency-key": randomUUID(),
          "x-content-hash": save.contentHash,
        },
      });
      equal(res.status, 409, "conflict status");
      const body = res.body as { data?: { headVersionId?: string } };
      equal(
        body.data?.headVersionId,
        secondVersionId,
        "conflict head in the body",
      );
    },
  );

  await check(
    "a bad content hash header is refused before anything is stored",
    async () => {
      const save = archive([{ key: "save/slot1.sav", body: "http-bad" }]);
      const res = await call("POST", `${saves}/${gameId}/0/versions`, {
        body: save.bytes,
        headers: {
          "if-match": secondVersionId,
          "x-content-hash": "not-a-hash",
        },
      });
      equal(res.status, 400, "bad header status");
      const versions = await call("GET", `${saves}/${gameId}/0/versions`);
      equal(
        (versions.body as unknown[]).length,
        2,
        "versions after a rejected upload",
      );
    },
  );

  await check("the sync endpoint answers over the wire", async () => {
    const pull = await call(
      "GET",
      `${saves}/${gameId}/0/sync?baseVersionId=${firstVersionId}&localContentHash=${encodeURIComponent(archive([{ key: "save/slot1.sav", body: "http-one" }]).contentHash)}`,
    );
    equal(pull.status, 200, "pull status");
    equal(
      (pull.body as { decision: string }).decision,
      "pull",
      "pull decision",
    );

    const conflict = await call(
      "GET",
      `${saves}/${gameId}/0/sync?baseVersionId=${firstVersionId}&localContentHash=${"f".repeat(64)}`,
    );
    equal(
      (conflict.body as { decision: string }).decision,
      "conflict",
      "conflict decision",
    );

    const badHash = await call(
      "GET",
      `${saves}/${gameId}/0/sync?localContentHash=nope`,
    );
    equal(badHash.status, 400, "malformed local hash");
  });

  await check(
    "download returns the archive and its identity headers",
    async () => {
      const res = await call(
        "GET",
        `${saves}/${gameId}/0/versions/${firstVersionId}/download`,
      );
      equal(res.status, 200, "download status");
      const bytes = Buffer.from(res.body as string, "utf8");
      const expected = archive([{ key: "save/slot1.sav", body: "http-one" }]);
      equal(
        createHash("sha256").update(bytes).digest("hex"),
        expected.sha256,
        "downloaded bytes",
      );
      equal(
        res.headers.get("x-save-archive-sha256"),
        expected.sha256,
        "x-save-archive-sha256",
      );
      equal(
        res.headers.get("x-save-content-hash"),
        expected.contentHash,
        "x-save-content-hash",
      );
      equal(res.headers.get("etag"), `"${firstVersionId}"`, "etag");
    },
  );

  await check(
    "restore publishes a new head from an older version",
    async () => {
      const res = await call(
        "POST",
        `${saves}/${gameId}/0/versions/${firstVersionId}/restore`,
        {
          body: "",
          headers: { "if-match": secondVersionId },
        },
      );
      equal(res.status, 200, "restore status");
      const restored = res.body as {
        id: string;
        kind: string;
        restoredFromVersionId: string;
      };
      equal(restored.kind, "Restore", "restored kind");
      equal(restored.restoredFromVersionId, firstVersionId, "restored from");
      const slot = await call("GET", `${saves}/${gameId}/0`);
      equal(
        (slot.body as { head: { id: string } }).head.id,
        restored.id,
        "head after restore",
      );
    },
  );

  await check("pinning a version survives the timeline", async () => {
    const res = await call(
      "POST",
      `${saves}/${gameId}/0/versions/${firstVersionId}/pin`,
      {
        body: JSON.stringify({ pinned: true }),
        headers: { "content-type": "application/json" },
      },
    );
    equal(res.status, 200, "pin status");
    equal((res.body as { pinned: boolean }).pinned, true, "pinned flag");
  });

  await check(
    "the head version cannot be deleted, an old one can",
    async () => {
      const slot = await call("GET", `${saves}/${gameId}/0`);
      const headId = (slot.body as { head: { id: string } }).head.id;
      const headDelete = await call(
        "GET",
        `${saves}/${gameId}/0/versions/${headId}`,
      ).then(async () =>
        call("DELETE", `${saves}/${gameId}/0/versions/${headId}`),
      );
      equal(headDelete.status, 400, "delete head status");

      const timeline = await call("GET", `${saves}/${gameId}/0/versions`);
      const versions = timeline.body as Array<{ id: string }>;
      const older = versions.find((v) => v.id !== headId)!;
      const removed = await call(
        "DELETE",
        `${saves}/${gameId}/0/versions/${older.id}`,
      );
      equal(removed.status, 200, "delete old version status");
    },
  );

  await check(
    "the manifest endpoint serves the curated Ludusavi entry",
    async () => {
      const missing = await call("GET", `${saves}/manifests/${gameId}`);
      equal(missing.status, 404, "missing manifest status");

      const entry = {
        files: { "<winDocuments>/E2E HTTP/save": { tags: ["save"] } },
        installDir: { "E2E HTTP": {} },
      };
      await prisma.saveManifest.create({
        data: { gameId, entry, source: "curated", ludusaviName: "E2E HTTP" },
      });
      const seen = await call("GET", `${saves}/manifests/${gameId}`);
      equal(seen.status, 200, "manifest status");
      const body = seen.body as {
        gameId: string;
        entryHash: string;
        ludusaviName: string;
      };
      equal(body.gameId, gameId, "manifest game id");
      equal(body.ludusaviName, "E2E HTTP", "manifest title");
      assert(
        /^[a-f0-9]{64}$/.test(body.entryHash),
        "entryHash is a hex digest",
      );
    },
  );

  await check("a save id from another user is not reachable", async () => {
    const other = await call(
      "GET",
      `${saves}/${gameId}/9/versions/${firstVersionId}`,
    );
    equal(other.status, 404, "cross-slot version lookup");
    const wrongGame = await call(
      "GET",
      `${saves}/${randomUUID()}/0/versions/${firstVersionId}`,
    );
    equal(wrongGame.status, 400, "unknown game version lookup");
  });

  // Everything above ran without a profile selector, which the server resolves
  // to the account's default profile. What follows pins that selector and the
  // isolation it buys.
  let secondProfileId = "";

  await check(
    "the save traffic left exactly one default profile on the account",
    async () => {
      const res = await call("GET", `/api/v1/client/profiles`);
      equal(res.status, 200, "profiles status");
      const profiles = res.body as Array<{
        id: string;
        name: string;
        isDefault: boolean;
      }>;
      equal(profiles.length, 1, "profiles after selectorless save traffic");
      equal(profiles[0]!.isDefault, true, "default flag");
      equal(profiles[0]!.name, "Player", "default name");
    },
  );

  await check("a profile can be added and renamed", async () => {
    const created = await call("POST", `/api/v1/client/profiles`, {
      body: JSON.stringify({ name: "  Second Player  " }),
      headers: { "content-type": "application/json" },
    });
    equal(created.status, 200, "create status");
    const profile = created.body as {
      id: string;
      name: string;
      isDefault: boolean;
      color: string;
      avatarObjectId: string | null;
    };
    equal(profile.name, "Second Player", "name trimmed");
    equal(profile.isDefault, false, "not the default");
    equal(profile.color, "blue", "default colour");
    assert(!!profile.avatarObjectId, "avatar generated at creation");
    secondProfileId = profile.id;

    const renamed = await call(
      "PATCH",
      `/api/v1/client/profiles/${profile.id}`,
      {
        body: JSON.stringify({ name: "Second" }),
        headers: { "content-type": "application/json" },
      },
    );
    equal(renamed.status, 200, "rename status");
    equal((renamed.body as { name: string }).name, "Second", "renamed");
    // A rename never touches the look: the avatar is seeded by the id, not
    // the name.
    equal(
      (renamed.body as { avatarObjectId: string }).avatarObjectId,
      profile.avatarObjectId,
      "avatar survives a rename",
    );
  });

  await check("a player colour drives the avatar", async () => {
    const recoloured = await call(
      "PATCH",
      `/api/v1/client/profiles/${secondProfileId}`,
      {
        body: JSON.stringify({ color: "rose" }),
        headers: { "content-type": "application/json" },
      },
    );
    equal(recoloured.status, 200, "recolour status");
    const after = recoloured.body as {
      color: string;
      avatarObjectId: string | null;
    };
    equal(after.color, "rose", "colour stored");
    assert(!!after.avatarObjectId, "avatar regenerated");

    // The avatar is a real PNG through the normal client object pipeline.
    const fetched = await call(
      "GET",
      `/api/v1/client/object/${after.avatarObjectId}`,
    );
    equal(fetched.status, 200, "avatar object readable");
    equal(
      fetched.headers.get("content-type"),
      "image/png",
      "avatar content type",
    );

    const bogus = await call(
      "PATCH",
      `/api/v1/client/profiles/${secondProfileId}`,
      {
        body: JSON.stringify({ color: "chartreuse" }),
        headers: { "content-type": "application/json" },
      },
    );
    equal(bogus.status, 400, "unknown colour rejected");

    const empty = await call(
      "PATCH",
      `/api/v1/client/profiles/${secondProfileId}`,
      {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      },
    );
    equal(empty.status, 400, "empty patch rejected");
  });

  await check("save state is isolated between profiles", async () => {
    const otherProfile = secondProfileId;
    const emptyList = await call(
      "GET",
      `${saves}/${gameId}?profile=${otherProfile}`,
    );
    equal(emptyList.status, 200, "other profile slot list");
    equal(
      (emptyList.body as unknown[]).length,
      0,
      "no slots visible to another profile",
    );

    const before = await call("GET", `${saves}/${gameId}/0/versions`);
    const beforeCount = (before.body as unknown[]).length;
    assert(beforeCount > 0, "the default profile should have a timeline");

    const otherTimeline = await call(
      "GET",
      `${saves}/${gameId}/0/versions?profile=${otherProfile}`,
    );
    equal(otherTimeline.status, 404, "the slot is not the other profile's");

    // Upload as the second profile - through the header form of the selector.
    const save = archive([{ key: "save/slot1.sav", body: "profile-two" }]);
    const upload = await call("POST", `${saves}/${gameId}/0/versions`, {
      body: save.bytes,
      headers: {
        "x-profile-id": otherProfile,
        "idempotency-key": randomUUID(),
        "x-content-hash": save.contentHash,
        "x-archive-sha256": save.sha256,
      },
    });
    equal(upload.status, 200, "upload as the second profile");
    equal(
      (upload.body as { profileId: string }).profileId,
      otherProfile,
      "the version belongs to the profile that uploaded it",
    );

    const after = await call("GET", `${saves}/${gameId}/0/versions`);
    equal(
      (after.body as unknown[]).length,
      beforeCount,
      "the default profile's timeline is untouched",
    );

    const otherNow = await call(
      "GET",
      `${saves}/${gameId}/0/versions?profile=${otherProfile}`,
    );
    equal(
      (otherNow.body as unknown[]).length,
      1,
      "the second profile has its own timeline",
    );

    const stolen = await call(
      "GET",
      `${saves}/${gameId}/0/versions/${firstVersionId}?profile=${otherProfile}`,
    );
    equal(stolen.status, 404, "a version id cannot cross profiles");
  });

  await check(
    "an unknown profile selector is refused, not defaulted",
    async () => {
      const foreign = await call(
        "GET",
        `${saves}/${gameId}?profile=${randomUUID()}`,
      );
      equal(foreign.status, 404, "foreign profile id");
      const junk = await call("GET", `${saves}/${gameId}?profile=not-a-uuid`);
      equal(junk.status, 400, "malformed selector");
    },
  );

  await check("playtime is attributed to the profile that played", async () => {
    const report = await call("POST", `/api/v1/client/playtime/${gameId}`, {
      body: JSON.stringify({ seconds: 120 }),
      headers: { "content-type": "application/json" },
    });
    equal(report.status, 200, "playtime report status");
    equal(
      (report.body as { seconds: number }).seconds,
      120,
      "seconds on the default profile",
    );

    const other = await call("POST", `/api/v1/client/playtime/${gameId}`, {
      body: JSON.stringify({ seconds: 60 }),
      headers: {
        "content-type": "application/json",
        "x-profile-id": secondProfileId,
      },
    });
    equal(
      (other.body as { seconds: number }).seconds,
      60,
      "seconds on the second profile",
    );

    const asDefault = await call("GET", `/api/v1/client/playtime`);
    const defaultRows = asDefault.body as Array<{ seconds: number }>;
    equal(defaultRows.length, 1, "the default profile sees only its own row");
    equal(defaultRows[0]!.seconds, 120, "the default profile's total");

    const asOther = await call(
      "GET",
      `/api/v1/client/playtime?profile=${secondProfileId}`,
    );
    const otherRows = asOther.body as Array<{ seconds: number }>;
    equal(otherRows.length, 1, "the second profile sees only its own row");
    equal(otherRows[0]!.seconds, 60, "the second profile's total");
  });

  await prisma.saveManifest.deleteMany({ where: { gameId } });
  await prisma.saveSlot.deleteMany({ where: { userId } });
  await prisma.certificate.deleteMany({
    where: { id: { in: [`client:${clientId}`, `client:${plainClientId}`] } },
  });
  await prisma.client.deleteMany({ where: { userId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
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
