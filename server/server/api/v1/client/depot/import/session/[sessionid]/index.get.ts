import { getRouterParam } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { systemConfig } from "~/server/internal/config/sys-conf";
import { depotRootFor } from "~/server/utils/depot/paths";
import {
  importSessionMissing,
  importSessionSummary,
  requireImportSession,
} from "~/server/utils/import/session";

/** Session state plus the still-missing object list, refreshed against the store. */
export default defineClientEventHandler(async (h3, utils) => {
  const user = await utils.fetchUser();
  if (!user.admin)
    throw createError({ statusCode: 403, message: "Admins publish imports" });
  const id = getRouterParam(h3, "sessionid")!;
  const session = requireImportSession(id);
  const missing = await importSessionMissing(
    depotRootFor(systemConfig.getDataFolder()),
    session,
  );
  return { ...importSessionSummary(session), missing };
});
