import { defineEventHandler, getRouterParam } from "h3";
import aclManager from "~/server/internal/acls";
import { systemConfig } from "~/server/internal/config/sys-conf";
import { depotRootFor } from "~/server/utils/depot/paths";
import { prismaImportDatabase } from "~/server/utils/import/db";
import {
  commitImportSession,
  requireImportSession,
} from "~/server/utils/import/session";

/**
 * Publish the session's release: every declared object must be in the store,
 * the manifest is the last write, provenance names the importer, and the new
 * GameVersion is pinned to the digest so clients start seeing it as a
 * chunk-addressed version immediately.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, ["import:game:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const id = getRouterParam(h3, "sessionid")!;
  const session = requireImportSession(id);
  return commitImportSession(
    depotRootFor(systemConfig.getDataFolder()),
    session,
    prismaImportDatabase(),
  );
});
