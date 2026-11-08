import { type } from "arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import { systemConfig } from "~/server/internal/config/sys-conf";
import { depotRootFor } from "~/server/utils/depot/paths";
import { prismaImportDatabase } from "~/server/utils/import/db";
import { openImportSession } from "~/server/utils/import/session";

const Chunk = type({
  size: "number",
  sha256: "string",
});

const File = type({
  path: "string",
  size: "number",
  "mode?": "number",
  sha256: "string",
  chunks: Chunk.array(),
});

const OpenBody = type({
  gameTitle: "string",
  "appVersion?": "string",
  "gameId?": "string",
  "device?": "string",
  "runsStandalone?": "boolean",
  files: File.array(),
}).configure(throwingArktype);

/**
 * Open a local-import session: the desktop declares a whole release (paths,
 * sizes, permission bits, per-chunk digests over the fixed 4 MiB chunking),
 * and the depot answers with the objects it does not have yet. Uploading
 * only that set is what makes bringing your own files cheaper than
 * downloading them again - for the importer and for everyone after them.
 *
 * Imports are the one client route where the account's admin flag gates
 * publishing: imported bytes are unverified content, and the depot decides
 * who vouches for a release, not whoever holds the files.
 */
export default defineClientEventHandler(async (h3, utils) => {
  const user = await utils.fetchUser();
  if (!user.admin)
    throw createError({
      statusCode: 403,
      message: "Only admins can publish imported releases",
    });

  const body = await readDropValidatedBody(h3, OpenBody);
  const result = await openImportSession(
    depotRootFor(systemConfig.getDataFolder()),
    {
      gameTitle: body.gameTitle,
      ...(body.appVersion !== undefined ? { appVersion: body.appVersion } : {}),
      ...(body.gameId !== undefined ? { gameId: body.gameId } : {}),
      ...(body.device !== undefined ? { device: body.device } : {}),
      ...(body.runsStandalone !== undefined
        ? { runsStandalone: body.runsStandalone }
        : {}),
      importer: `user:${user.id}`,
      files: body.files,
    },
    prismaImportDatabase(),
  );

  return {
    sessionId: result.session.id,
    releaseDigest: result.digest,
    totalFiles: result.session.files.length,
    totalBytes: result.session.totalBytes,
    totalObjects: result.totalObjects,
    missingObjects: result.missing.length,
    missing: result.missing,
  };
});
