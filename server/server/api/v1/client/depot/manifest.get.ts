import { readFile } from "node:fs/promises";
import { ArkErrors, type } from "arktype";
import { createError, getQuery, setHeader } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { systemConfig } from "~/server/internal/config/sys-conf";
import prisma from "~/server/internal/db/database";
import { parseDropletManifest } from "~/server/utils/depot/manifest";
import {
  casManifestPath,
  depotRootFor,
  isContentDigest,
} from "~/server/utils/depot/paths";

const Query = type({
  version: "string",
});

/**
 * The `gamedepot-droplet` manifest of a version, byte for byte as published, so
 * a client can recompute the digest over exactly what it was sent and then
 * address every chunk of the release by its own digest.
 *
 * Authorization is the same as the upstream-manifest endpoint next door: an
 * authenticated client may name a version. The digest is the ETag and the
 * document never changes for a version, so a client may cache it forever.
 */
export default defineClientEventHandler(async (h3) => {
  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, message: query.summary });

  const version = await prisma.gameVersion.findUnique({
    where: { versionId: query.version },
    select: { versionId: true, casManifestDigest: true },
  });
  if (!version)
    throw createError({ statusCode: 404, message: "Version not found" });
  if (!isContentDigest(version.casManifestDigest))
    throw createError({
      statusCode: 404,
      message:
        "This version has not been chunked into the content-addressed depot yet",
    });

  const path = casManifestPath(
    depotRootFor(systemConfig.getDataFolder()),
    version.casManifestDigest,
  );
  const text = await readFile(path, "utf8").catch(() => {
    throw createError({
      statusCode: 500,
      message: "The manifest of this version is missing from the depot store",
    });
  });
  // Never serve a document its own digest does not cover: a store that lost or
  // rewrote bytes has to fail here rather than hand out a release nobody can
  // verify.
  try {
    parseDropletManifest(text);
  } catch {
    throw createError({
      statusCode: 500,
      message: "The manifest of this version does not match its own digest",
    });
  }

  const etag = `"${version.casManifestDigest}"`;
  setHeader(h3, "ETag", etag);
  if (h3.headers.get("if-none-match") === etag) {
    setResponseStatus(h3, 304);
    return null;
  }
  setHeader(h3, "Content-Type", "application/json");
  setHeader(h3, "Cache-Control", "private, max-age=31536000, immutable");
  return text;
});
