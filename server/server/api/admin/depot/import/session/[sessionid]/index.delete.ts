import { defineEventHandler, getRouterParam } from "h3";
import aclManager from "~/server/internal/acls";
import {
  requireImportSession,
  cancelImportSession,
} from "~/server/utils/import/session";

/**
 * Abandon an upload. Objects already stored stay: they are content-addressed,
 * and the next release that needs the same bytes dedupes against them for
 * free. Nothing else is touched.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, ["import:game:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const id = getRouterParam(h3, "sessionid")!;
  const session = requireImportSession(id);
  cancelImportSession(session);
  return { cancelled: true };
});
