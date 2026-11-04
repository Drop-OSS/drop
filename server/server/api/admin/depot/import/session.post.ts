import { type } from "arktype";
import { defineEventHandler } from "h3";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import { systemConfig } from "~/server/internal/config/sys-conf";
import sessionHandler from "~/server/internal/session";
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
  files: File.array(),
}).configure(throwingArktype);

/**
 * Open a local-import session: the client declares a whole release (paths,
 * sizes, permission bits, per-chunk digests over the fixed 4 MiB chunking),
 * and the depot answers with the objects it does not have yet. Uploading
 * only that set is what makes bringing your own files cheaper than
 * downloading them again - for the importer and for everyone after them.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, ["import:game:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  // The provenance record names who published; an admin session is a person,
  // a system token is the machine acting on its own.
  const session = await sessionHandler.getSession(h3);
  const importer = session?.authenticated
    ? `user:${session.authenticated.userId}`
    : "system-token";

  const body = await readDropValidatedBody(h3, OpenBody);
  const result = await openImportSession(
    depotRootFor(systemConfig.getDataFolder()),
    {
      gameTitle: body.gameTitle,
      ...(body.appVersion !== undefined ? { appVersion: body.appVersion } : {}),
      ...(body.gameId !== undefined ? { gameId: body.gameId } : {}),
      ...(body.device !== undefined ? { device: body.device } : {}),
      importer,
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
