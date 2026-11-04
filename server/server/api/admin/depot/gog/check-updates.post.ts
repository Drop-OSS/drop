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
 * and task log, from here or from the button.
 *
 * Entitled games the depot has never acquired are reported, not fetched:
 * new purchases are a decision (disk, taste), new builds of games the depot
 * already serves are maintenance, and only maintenance is automatic.
 */
export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });

  // Lazy imports keep the prisma/connection machinery out of cold routes,
  // as in the ingest endpoints.
  const [
    { prismaConnectionStore },
    { resolveDepotToken },
    { default: prisma },
    { getGogLibrary },
    { getGogProductBuilds },
    { scanImportedByProvider, pickLatestGogBuild, isNewerBuild },
    { queueLocalGogIngest },
  ] = await Promise.all([
    import("../../../../utils/depot/connection-store"),
    import("../../../../utils/depot/connections"),
    import("~/server/internal/db/database"),
    import("../../../../utils/gog"),
    import("../../../../utils/gog/cdn"),
    import("../../../../utils/depot/update-check"),
    import("../../../../utils/depot/ingest-queue"),
  ]);

  let token: string;
  try {
    token = (await resolveDepotToken(prismaConnectionStore, "gog")).token;
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : "No GOG connection to check",
    });
  }

  // The scan's Prisma surface is the minimal structural type its tests
  // stub; the real client is wider than it in every direction.
  const imported = await scanImportedByProvider(
    prisma as unknown as Parameters<typeof scanImportedByProvider>[0],
    "gog",
  );

  // Sequential by design: this scans the same account the acquisitions
  // download for, and a burst of build-list calls in front of a hundred
  // downloads is neither faster nor politer.
  const updates: {
    productId: string;
    title: string;
    current: string | null;
    latest: string;
    queued: boolean;
  }[] = [];
  const unreadable: string[] = [];
  for (const row of imported) {
    let latest: string | null;
    try {
      latest = pickLatestGogBuild(
        await getGogProductBuilds(row.productId, { accessToken: token }),
      );
    } catch {
      // Legacy (generation 1) products and transient failures answer
      // nothing; the game is simply not checked this round.
      unreadable.push(row.productId);
      continue;
    }
    if (!isNewerBuild(row.latestVersion, latest)) continue;
    let queued = true;
    try {
      await queueLocalGogIngest(row.productId, row.title, undefined);
    } catch {
      // Most likely 409: an acquisition for this game is already running,
      // which is exactly the outcome the check wanted.
      queued = false;
    }
    updates.push({
      productId: row.productId,
      title: row.title,
      current: row.latestVersion,
      latest: latest!,
      queued,
    });
  }

  // What the account owns that the depot has never acquired, for the admin
  // to weigh - reported only, never fetched.
  let unimported: { productId: string; title: string }[] = [];
  try {
    const known = new Set(imported.map((row) => row.productId));
    unimported = (await getGogLibrary(token))
      .filter((game) => !known.has(String(game.id)))
      .map((game) => ({
        productId: String(game.id),
        title: String(game.title ?? game.id),
      }));
  } catch {
    // The update answers above are the point; a failed listing changes
    // nothing about them.
  }

  return {
    provider: "gog",
    checked: imported.length - unreadable.length,
    updates,
    unimported,
    unreadable,
  };
});
