import { getRouterParam } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
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
export default defineClientEventHandler(async (h3, utils) => {
  const user = await utils.fetchUser();
  if (!user.admin)
    throw createError({ statusCode: 403, message: "Admins publish imports" });
  const id = getRouterParam(h3, "sessionid")!;
  const session = requireImportSession(id);
  return commitImportSession(
    depotRootFor(systemConfig.getDataFolder()),
    session,
    prismaImportDatabase(),
  );
});
