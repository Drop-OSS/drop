import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createError, getRouterParam, setHeader } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { systemConfig } from "~/server/internal/config/sys-conf";
import prisma from "~/server/internal/db/database";
import { readDropletManifest } from "~/server/utils/depot/manifest";
import {
  casManifestPath,
  casObjectPath,
  depotRootFor,
  isContentDigest,
} from "~/server/utils/depot/paths";

/**
 * One chunk object of a version, addressed by the SHA-256 of its bytes.
 *
 * The version stays in the route on purpose: it is what the client is allowed
 * to name, and the manifest of that version is what decides which digests may
 * be fetched. So a client can walk a release it may download, but cannot use
 * this route to pull arbitrary content out of the store by guessing digests.
 *
 * The bytes are exactly what the manifest describes - stored raw, verified by
 * the client against the digest it asked for - and they never change, so the
 * response is immutable and resumable by design.
 */
export default defineClientEventHandler(async (h3) => {
  const versionId = getRouterParam(h3, "versionid");
  const sha256 = getRouterParam(h3, "sha256");
  if (!versionId)
    throw createError({ statusCode: 400, message: "No versionID in route" });
  if (!sha256 || !isContentDigest(sha256))
    throw createError({
      statusCode: 400,
      message: "Chunk must be a lowercase SHA-256 hex digest",
    });

  const version = await prisma.gameVersion.findUnique({
    where: { versionId },
    select: { versionId: true, casManifestDigest: true },
  });
  if (!version)
    throw createError({ statusCode: 404, message: "Version not found" });
  if (!version.casManifestDigest)
    throw createError({
      statusCode: 404,
      message:
        "This version has not been chunked into the content-addressed depot yet",
    });

  const root = depotRootFor(systemConfig.getDataFolder());
  const manifest = await readDropletManifest(
    casManifestPath(root, version.casManifestDigest),
  ).catch(() => {
    throw createError({
      statusCode: 500,
      message: "The manifest of this version is missing from the depot store",
    });
  });

  const stored = manifest.chunkIndex[sha256];
  if (!stored)
    throw createError({
      statusCode: 404,
      message: "That chunk is not part of this version",
    });

  // The manifest stores where it put the object; only the layout this server
  // writes is acceptable, so a manifest can never name a path outside the store.
  const expected = `objects/${sha256.slice(0, 2)}/${sha256}`;
  if (stored.object !== expected)
    throw createError({
      statusCode: 500,
      message: "The manifest of this version points at an unexpected path",
    });

  const objectPath = casObjectPath(root, sha256);
  const info = await stat(objectPath).catch(() => undefined);
  if (!info)
    throw createError({
      statusCode: 500,
      message: "The depot store is missing a chunk this version requires",
    });
  if (info.size !== stored.size)
    throw createError({
      statusCode: 500,
      message: "A stored chunk does not have the size its manifest promises",
    });

  const etag = `"${sha256}"`;
  setHeader(h3, "ETag", etag);
  if (h3.headers.get("if-none-match") === etag) {
    setResponseStatus(h3, 304);
    return null;
  }
  setHeader(h3, "Content-Type", "application/octet-stream");
  setHeader(h3, "Content-Length", info.size);
  setHeader(h3, "X-Content-Digest", `sha-256=${sha256}`);
  setHeader(h3, "Cache-Control", "private, max-age=31536000, immutable");
  return createReadStream(objectPath);
});
