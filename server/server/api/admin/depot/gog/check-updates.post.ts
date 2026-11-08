import { createError, defineEventHandler } from "h3";
import aclManager from "~/server/internal/acls";

/**
 * Ask GOG whether any imported game has a newer build, and queue the
 * acquisitions for the ones that do.
 *
 * This is the node keeping its own library current: the games this server
 * acquired from GOG (`gog-<productId>` rows) are matched against the
 * account's entitled products, each imported product's newest stable build
 * is read from the content system, and a build we do not already hold is
 * queued through the very same ingest task an admin press would start - so
 * an update lands as a new version with the same idempotence, provenance
 * and task log, from here or from the daily `depot:check-updates` task.
 *
 * Entitled games the depot has never acquired are reported, not fetched:
 * new purchases are a decision (disk, taste), new builds of games the depot
 * already serves are maintenance, and only maintenance is automatic.
 */
export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });

  // Lazy import keeps the prisma/connection machinery out of cold routes,
  // as in the ingest endpoints; the scan reports its failures as errors
  // with the status this route should answer with.
  const { scanGogUpdates } =
    await import("../../../../utils/depot/update-scan");
  return scanGogUpdates();
});
