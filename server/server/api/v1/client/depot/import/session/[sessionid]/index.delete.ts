import { getRouterParam } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import {
  cancelImportSession,
  requireImportSession,
} from "~/server/utils/import/session";

/**
 * Abandon an upload. Objects already stored stay: they are content-addressed,
 * and the next release that needs the same bytes dedupes against them for
 * free. Nothing else is touched.
 */
export default defineClientEventHandler(async (h3, utils) => {
  const user = await utils.fetchUser();
  if (!user.admin)
    throw createError({ statusCode: 403, message: "Admins publish imports" });
  const id = getRouterParam(h3, "sessionid")!;
  const session = requireImportSession(id);
  cancelImportSession(session);
  return { cancelled: true };
});
