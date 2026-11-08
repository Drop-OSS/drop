import { createError, defineEventHandler } from "h3";
import aclManager from "~/server/internal/acls";

/**
 * Ask Ubisoft Connect whether any imported game has a newer deploy, and
 * queue the acquisitions for the ones that do.
 *
 * The Ubisoft answer to "what is the newest build" is the entitlement's
 * latest install manifest (a SHA-1), which is exactly what the acquisition
 * records as the imported version's name - so the check is one ownership
 * call and a hex comparison. A newer manifest is queued through the same
 * ingest task the admin button starts - and through the same shared scan
 * the daily `depot:check-updates` task runs; games the depot has never
 * acquired are reported, not fetched.
 */
export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });

  const { scanUbisoftUpdates } =
    await import("../../../../utils/depot/update-scan");
  return scanUbisoftUpdates();
});
