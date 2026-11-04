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
 * ingest task the admin button starts; games the depot has never acquired
 * are reported, not fetched.
 */
export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });

  const [
    { prismaConnectionStore },
    { resolveDepotToken },
    { default: prisma },
    { scanImportedByProvider, isNewerBuild },
    { queueLocalUbisoftIngest },
    { UbisoftAcquisitionClient },
  ] = await Promise.all([
    import("../../../../utils/depot/connection-store"),
    import("../../../../utils/depot/connections"),
    import("~/server/internal/db/database"),
    import("../../../../utils/depot/update-check"),
    import("../../../../utils/depot/ingest-queue"),
    import("../../../../utils/ubisoft/demux/acquisition"),
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

  const updates: {
    productId: string;
    title: string;
    current: string | null;
    latest: string;
    queued: boolean;
  }[] = [];
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
});
