import { createError } from "h3";

/**
 * The provider update check, shared by the admin button and the daily task.
 *
 * The node-owned providers (GOG, Ubisoft) answer "is there a newer build"
 * from the admin's stored connection; a newer build is queued through the
 * very same ingest task an admin press would start, so an update arrives as
 * a new version with identical idempotence, provenance and task log whether
 * the button or the calendar asked for it.
 *
 * These functions throw `createError` shapes rather than mapping to a
 * response: a route lets them travel to the client, the scheduled task
 * reads the code and decides whether "not connected right now" is a skip
 * or a warning. Never fetch a game the depot has never acquired - owned
 * but unacquired titles are reported, not fetched; starting a library is a
 * decision, keeping one current is maintenance.
 */

export type ProviderUpdateRow = {
  productId: string;
  title: string;
  current: string | null;
  latest: string;
  queued: boolean;
};

export type ProviderScan = {
  provider: "gog" | "ubisoft";
  checked: number;
  updates: ProviderUpdateRow[];
  unimported: { productId: string; title: string }[];
  /** GOG only: products whose build list answered nothing (legacy gen-1). */
  unreadable?: string[];
};

/** Ask GOG whether any imported game has a newer build, and queue them. */
export async function scanGogUpdates(): Promise<ProviderScan> {
  const [
    { prismaConnectionStore },
    { resolveDepotToken },
    { default: prisma },
    { getGogLibrary },
    { getGogProductBuilds },
    { scanImportedByProvider, pickLatestGogBuild, isNewerBuild },
    { queueLocalGogIngest },
  ] = await Promise.all([
    import("./connection-store"),
    import("./connections"),
    import("~/server/internal/db/database"),
    import("~/server/utils/gog"),
    import("~/server/utils/gog/cdn"),
    import("./update-check"),
    import("./ingest-queue"),
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
  const updates: ProviderUpdateRow[] = [];
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
}

/** Ask Ubisoft Connect whether any imported game has a newer deploy, and
 * queue them. */
export async function scanUbisoftUpdates(): Promise<ProviderScan> {
  const [
    { prismaConnectionStore },
    { resolveDepotToken },
    { default: prisma },
    { scanImportedByProvider, isNewerBuild },
    { queueLocalUbisoftIngest },
    { UbisoftAcquisitionClient },
  ] = await Promise.all([
    import("./connection-store"),
    import("./connections"),
    import("~/server/internal/db/database"),
    import("./update-check"),
    import("./ingest-queue"),
    import("~/server/utils/ubisoft/demux/acquisition"),
  ]);

  let token: string;
  try {
    token = (await resolveDepotToken(prismaConnectionStore, "ubisoft")).token;
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error
          ? error.message
          : "No Ubisoft connection to check",
    });
  }

  const imported = await scanImportedByProvider(
    prisma as unknown as Parameters<typeof scanImportedByProvider>[0],
    "ubi",
  );

  // One ownership call answers every game, so the client opens once.
  const client = await UbisoftAcquisitionClient.connect(token).catch(() => {
    throw createError({
      statusCode: 502,
      statusMessage: "Could not reach the Ubisoft ownership service",
    });
  });
  let owned: Awaited<ReturnType<typeof client.listOwnedGames>>;
  try {
    owned = await client.listOwnedGames();
  } finally {
    client.destroy();
  }
  const byProductId = new Map(
    owned.map((game) => [String(game.productId), game]),
  );

  const updates: ProviderUpdateRow[] = [];
  for (const row of imported) {
    const entitlement = byProductId.get(row.productId);
    const latest = entitlement?.latestManifest ?? null;
    if (!isNewerBuild(row.latestVersion, latest)) continue;
    let queued = true;
    try {
      await queueLocalUbisoftIngest(
        Number(row.productId),
        undefined,
        undefined,
        row.title,
      );
    } catch {
      // Most likely 409: an acquisition is already running for it.
      queued = false;
    }
    updates.push({
      productId: row.productId,
      title: entitlement?.title ?? row.title,
      current: row.latestVersion,
      latest: latest!,
      queued,
    });
  }

  const known = new Set(imported.map((row) => row.productId));
  const unimported = owned
    .filter((game) => game.owned && !known.has(String(game.productId)))
    .map((game) => ({
      productId: String(game.productId),
      title: game.title ?? String(game.productId),
    }));

  return {
    provider: "ubisoft",
    checked: imported.length,
    updates,
    unimported,
  };
}
