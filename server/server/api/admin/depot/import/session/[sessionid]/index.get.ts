import { defineEventHandler, getRouterParam } from "h3";
import aclManager from "~/server/internal/acls";
import { systemConfig } from "~/server/internal/config/sys-conf";
import { depotRootFor } from "~/server/utils/depot/paths";
import {
  importSessionMissing,
  importSessionSummary,
  requireImportSession,
} from "~/server/utils/import/session";

/** Session state plus the still-missing object list, refreshed against the store. */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, ["import:game:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const id = getRouterParam(h3, "sessionid")!;
  const session = requireImportSession(id);
  const missing = await importSessionMissing(
    depotRootFor(systemConfig.getDataFolder()),
    session,
  );
  return { ...importSessionSummary(session), missing };
});
