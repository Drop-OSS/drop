/**
 * HTTP drive of the content-addressed depot endpoints against a running
 * server: real routing, real client-certificate auth, real bytes. Proves the
 * contract a chunked client depends on - the manifest is served byte-for-byte
 * so it self-verifies, every chunk hashes to the digest it was requested by,
 * immutable ETags, and that no route leaks chunks across versions.
 *
 *   DATABASE_URL=... GD_E2E_URL=http://gamedepot:4000 pnpm e2e:depot-cas
 *
 * The positive checks run against the first version already chunked on this
 * server; a server with none yet skips them (chunking is an explicit admin
 * action, not part of this script). The guard checks - auth, unknown versions,
 * un-chunked versions, malformed digests, cross-version digests - always run.
 * Scratch user/client/certificate rows are removed again; the same
 * scratch-database guard as `saves.e2e.ts` applies.
 */
import "./nitro-stubs";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { canonicalize } from "json-canonicalize";
import jwt from "jsonwebtoken";
import prisma from "~/server/internal/db/database";

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

type ManifestDoc = {
  format: string;
  version: number;
  digest: string;
  files: Array<{
    path: string;
    size: number;
    sha256: string;
    mode: number;
    chunks: Array<{
      index: number;
      offset: number;
      size: number;
      sha256: string;
      object: string;
    }>;
  }>;
  chunkIndex: Record<string, { object: string; size: number }>;
};

function clientToken(privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ nbf: now, exp: now + 30 }, privateKey, {
    algorithm: "ES384",
  });
}

async function main() {
  console.log(`database: ${databaseName || "?"}`);
  console.log(`server:   ${baseUrl}\n`);

  const userId = randomUUID();
  const clientId = randomUUID();

  // A self-generated ES384 pair plays the part of a CA-issued client
  // certificate, as in saves-http.e2e.ts.
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "secp384r1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // One un-chunked scratch version so the "not chunked yet" guards have a real
  // row to answer about, whatever else this server holds.
  const libraryId = randomUUID();
  const gameId = randomUUID();
  const versionId = randomUUID();

  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        username: "e2e-cas",
        displayName: "E2E CAS",
        email: "e2e-cas@example.invalid",
        profilePictureObjectId: "",
      },
    }),
    prisma.library.create({
      data: {
        id: libraryId,
        name: "E2E CAS",
        backend: "Filesystem",
        options: {},
      },
    }),
    prisma.game.create({
      data: {
        id: gameId,
        metadataSource: "Manual",
        metadataId: `e2e-cas-${gameId}`,
        mName: "E2E CAS Game",
        mShortDescription: "e2e",
        mDescription: "e2e",
        mReleased: new Date(0),
        mIconObjectId: "",
        mBannerObjectId: "",
        mCoverObjectId: "",
        mImageCarouselObjectIds: [],
        mImageLibraryObjectIds: [],
        libraryId,
        libraryPath: "e2e-cas",
      },
    }),
    prisma.gameVersion.create({
      data: {
        versionId,
        gameId,
        versionPath: "unchunked",
        versionIndex: 0,
        dropletManifest: {},
        fileList: [],
        negativeFileList: [],
      },
    }),
    prisma.client.create({
      data: {
        id: clientId,
        userId,
        name: "e2e-cas",
        platform: "Linux",
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
  ]);

  async function call(method: string, path: string, headers = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `JWT ${clientId} ${clientToken(privateKey)}`,
        ...headers,
      },
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* a chunk body is not JSON */
    }
    return { status: response.status, body, headers: response.headers };
  }

  async function callRaw(method: string, path: string, headers = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `JWT ${clientId} ${clientToken(privateKey)}`,
        ...headers,
      },
    });
    return {
      status: response.status,
      bytes: Buffer.from(await response.arrayBuffer()),
      headers: response.headers,
    };
  }

  const anonymous = async (method: string, path: string) => {
    const response = await fetch(`${baseUrl}${path}`, { method });
    return response.status;
  };

  const manifestPath = (v: string) =>
    `/api/v1/client/depot/manifest?version=${v}`;

  await check("an unauthenticated manifest call is refused", async () => {
    equal(await anonymous("GET", manifestPath(versionId)), 403, "anonymous");
  });

  await check("an unauthenticated chunk call is refused", async () => {
    equal(
      await anonymous(
        "GET",
        `/api/v1/client/depot/content/${versionId}/${"0".repeat(64)}`,
      ),
      403,
      "anonymous",
    );
  });

  await check("a version that does not exist is a 404", async () => {
    equal(
      (await call("GET", manifestPath(randomUUID()))).status,
      404,
      "unknown version",
    );
  });

  await check(
    "a version with no chunk manifest is a 404, not a 500",
    async () => {
      equal(
        (await call("GET", manifestPath(versionId))).status,
        404,
        "unchunked version",
      );
    },
  );

  await check("a malformed chunk digest is a 400", async () => {
    equal(
      (await callRaw("GET", `/api/v1/client/depot/content/${versionId}/nope`))
        .status,
      400,
      "not a digest",
    );
    // Uppercase and wrong length are not what the store addresses objects by.
    equal(
      (
        await callRaw(
          "GET",
          `/api/v1/client/depot/content/${versionId}/${"A".repeat(64)}`,
        )
      ).status,
      400,
      "uppercase digest",
    );
  });

  await check("the chunk route for an unknown version is a 404", async () => {
    equal(
      (
        await callRaw(
          "GET",
          `/api/v1/client/depot/content/${randomUUID()}/${"0".repeat(64)}`,
        )
      ).status,
      404,
      "unknown version",
    );
  });

  await check("the admin chunk route refuses a client JWT", async () => {
    const res = await call(
      "POST",
      `/api/v1/admin/game/${gameId}/versions/${versionId}/chunk`,
    );
    equal(res.status, 403, "client JWT cannot start chunking");
  });

  // Positive checks against whatever this server has actually chunked.
  const chunked = await prisma.gameVersion.findFirst({
    where: { casManifestDigest: { not: "" } },
    select: { versionId: true, casManifestDigest: true },
    orderBy: { created: "desc" },
  });

  if (!chunked) {
    console.log(
      "\nskipped: no version on this server has been chunked yet (chunk one from the admin version list to run the positive checks)",
    );
  } else {
    console.log(
      `\nchunked version: ${chunked.versionId} @ ${chunked.casManifestDigest.slice(0, 12)}\n`,
    );

    let doc: ManifestDoc | undefined;

    await check(
      "the manifest is served self-consistent and immutable",
      async () => {
        const res = await call("GET", manifestPath(chunked.versionId));
        equal(res.status, 200, "status");
        equal(
          res.headers.get("etag"),
          `"${chunked.casManifestDigest}"`,
          "ETag",
        );
        assert(
          (res.headers.get("cache-control") ?? "").includes("immutable"),
          "manifest should be cache-immutable",
        );
        doc = res.body as ManifestDoc;
        equal(doc.format, "gamedepot-droplet", "format");
        equal(doc.version, 1, "version");
        // The bytes we were sent must hash to the digest the row names, over
        // exactly the document minus its own digest field - that is what makes
        // the server's store verifiable over the wire.
        const { digest: served, ...base } = doc;
        equal(served, chunked.casManifestDigest, "served digest");
        const recomputed = createHash("sha256")
          .update(canonicalize(base))
          .digest("hex");
        equal(
          recomputed,
          chunked.casManifestDigest,
          "recomputed manifest digest",
        );
      },
    );

    await check(
      "a repeat manifest fetch with the ETag answers 304",
      async () => {
        const res = await call("GET", manifestPath(chunked.versionId), {
          "if-none-match": `"${chunked.casManifestDigest}"`,
        });
        equal(res.status, 304, "conditional GET");
      },
    );

    // Exercise one interior chunk and the final (tail-sized) chunk of the
    // largest file, so both the full 4 MiB path and the ragged end are read.
    const filesWithChunks = (doc?.files ?? []).filter(
      (f) => f.chunks.length > 0,
    );
    const biggest = filesWithChunks.sort((a, b) => b.size - a.size)[0];

    if (biggest) {
      const picks = [biggest.chunks[0], biggest.chunks.at(-1)!].filter(
        (c, i, all) => all.findIndex((o) => o.sha256 === c.sha256) === i,
      );
      for (const pick of picks) {
        await check(
          `chunk ${pick.sha256.slice(0, 12)} arrives as its own bytes`,
          async () => {
            const res = await callRaw(
              "GET",
              `/api/v1/client/depot/content/${chunked.versionId}/${pick.sha256}`,
            );
            equal(res.status, 200, "status");
            equal(res.bytes.length, pick.size, "served size vs manifest size");
            const actual = createHash("sha256").update(res.bytes).digest("hex");
            equal(actual, pick.sha256, "chunk bytes hash to their digest");
            equal(
              res.headers.get("x-content-digest"),
              `sha-256=${pick.sha256}`,
              "X-Content-Digest",
            );
          },
        );
      }

      await check(
        "a repeat chunk fetch with the ETag answers 304",
        async () => {
          const res = await callRaw(
            "GET",
            `/api/v1/client/depot/content/${chunked.versionId}/${picks[0].sha256}`,
            { "if-none-match": `"${picks[0].sha256}"` },
          );
          equal(res.status, 304, "conditional GET");
        },
      );
    }

    await check(
      "a digest from another release's chunks is not served",
      async () => {
        // sha256 of text no depot object can be: right shape, not in any manifest.
        const foreign = createHash("sha256")
          .update("gd-e2e-not-a-real-chunk")
          .digest("hex");
        const res = await callRaw(
          "GET",
          `/api/v1/client/depot/content/${chunked.versionId}/${foreign}`,
        );
        equal(res.status, 404, "foreign digest");
      },
    );
  }

  await prisma.gameVersion.deleteMany({ where: { versionId } });
  await prisma.certificate.deleteMany({ where: { id: `client:${clientId}` } });
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
