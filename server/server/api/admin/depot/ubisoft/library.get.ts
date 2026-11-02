import { createError, defineEventHandler, getQuery } from "h3";
import aclManager from "~/server/internal/acls";
import { getUbisoftOwnedTitles } from "../../../../utils/ubisoft/client";
import { resolveDepotToken } from "../../../../utils/depot/connections";
import {
  UbisoftAcquisitionClient,
  type UbisoftOwnedGame,
} from "../../../../utils/ubisoft/demux/acquisition";

/**
 * Ubisoft library listing. Two sources, merged:
 *  - the ownership (demux) socket: entitled products with numeric product
 *    ids, the latest install manifest and install configuration - the only
 *    source the acquisition pipeline can act on;
 *  - the library GraphQL gateway: human names and release dates keyed by
 *    space id (its own product ids are not demux product ids).
 * `ubiservices_space_id` is the reconciliation key. When demux is
 * unreachable the listing degrades to GraphQL rows with installable=false
 * rather than failing.
 */

type ListingGame = {
  /** Demux product id - the ingest endpoint's identifier; absent if demux silent. */
  gameId?: string;
  spaceId: string;
  name: string;
  releaseDate?: string;
  /** Latest install manifest SHA-1 the entitlement points at. */
  latestManifest?: string;
  /** Demux says this product can be acquired right now. */
  installable: boolean;
  /** Why not (only when demux answered and it is not installable). */
  reason?: string;
};

export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:read"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const query = getQuery(event);

  let ticket: string;
  let connectionId: string | undefined;
  try {
    // Lazy import keeps the prisma-backed store out of the module graph
    // until a request actually needs a stored connection.
    const { prismaConnectionStore } =
      await import("../../../../utils/depot/connection-store");
    const resolved = await resolveDepotToken(prismaConnectionStore, "ubisoft");
    ticket = resolved.token;
    connectionId = resolved.connectionId;
  } catch (error) {
    // Expired stored connections say so directly; everything else is the
    // same "no usable credentials" answer for the admin panel.
    if ((error as { statusCode?: number }).statusCode === 410) throw error;
    throw createError({
      statusCode: 401,
      statusMessage:
        "No usable Ubisoft Connect connection - sign in through the depot admin panel first",
    });
  }

  const [titles, demux] = await Promise.allSettled([
    getUbisoftOwnedTitles(ticket),
    listDemuxGames(ticket),
  ]);
  if (titles.status === "rejected") {
    const statusCode =
      (titles.reason as { statusCode?: number })?.statusCode ?? 0;
    throw createError({
      statusCode: statusCode === 401 || statusCode === 403 ? statusCode : 502,
      statusMessage:
        statusCode === 401 || statusCode === 403
          ? "Ubisoft Connect rejected the session ticket"
          : "Unable to retrieve Ubisoft owned titles",
    });
  }
  const demuxError =
    demux.status === "rejected"
      ? String(
          (demux.reason as { statusMessage?: string })?.statusMessage ??
            demux.reason ??
            "demux unavailable",
        ).slice(0, 200)
      : null;

  const bySpace = new Map<
    string,
    { spaceId: string; name?: string; releaseDate?: string }
  >();
  for (const title of titles.value) {
    if (!title.spaceId) continue;
    bySpace.set(title.spaceId.toLowerCase(), title);
  }

  const games: ListingGame[] = [];
  const matchedSpaces = new Set<string>();
  for (const entry of demux.status === "fulfilled" ? demux.value : []) {
    const spaceKey = entry.spaceId?.toLowerCase() ?? "";
    const graphql = spaceKey ? bySpace.get(spaceKey) : undefined;
    if (graphql) matchedSpaces.add(spaceKey);
    const name =
      graphql?.name || entry.title || `Ubisoft product ${entry.productId}`;
    const installable =
      entry.owned && entry.latestManifest !== null && entry.launches.length > 0;
    games.push({
      gameId: String(entry.productId),
      spaceId: entry.spaceId ?? graphql?.spaceId ?? "",
      name,
      releaseDate: graphql?.releaseDate,
      latestManifest: entry.latestManifest ?? undefined,
      installable,
      ...(installable
        ? {}
        : {
            reason: !entry.owned
              ? "not owned"
              : !entry.latestManifest
                ? "no install manifest published"
                : "install configuration declares no launchable executable",
          }),
    });
  }
  // GraphQL rows without a demux match: entitled somewhere public-facing but
  // not acquirable through the download pipeline (pre-demux era catalogue
  // entries, subscriptions, cloud-only titles).
  for (const title of titles.value) {
    const spaceKey = title.spaceId?.toLowerCase() ?? "";
    if (matchedSpaces.has(spaceKey)) continue;
    games.push({
      spaceId: title.spaceId,
      name: title.name || title.spaceId,
      releaseDate: title.releaseDate,
      installable: demux.status !== "fulfilled",
      ...(demux.status === "fulfilled"
        ? { reason: "not listed by the ownership service" }
        : { reason: `ownership service unavailable: ${demuxError}` }),
    });
  }

  // Cache the listing for the stored connection so the panel shows what is
  // local even between live refreshes; keyed by demux product id, the same
  // id the ingest records imports under. Best-effort.
  if (connectionId) {
    try {
      const { recordStoreManifests } =
        await import("../../../../utils/depot/connection-store");
      await recordStoreManifests(
        connectionId,
        games
          .filter((game) => game.gameId)
          .map((game) => ({
            externalGameId: game.gameId!,
            title: game.name,
            version: game.latestManifest ?? undefined,
            payload: game,
          })),
      );
    } catch {
      // Swallowed deliberately: the caller gets the fresh listing regardless.
    }
  }

  const filter =
    typeof query.title === "string"
      ? query.title.trim().toLocaleLowerCase()
      : "";
  const filtered = filter
    ? games.filter((game) => game.name.toLocaleLowerCase().includes(filter))
    : games;

  return { games: filtered, total: filtered.length, demuxError };
});

/** Demux entitlements, with the socket torn down no matter what. */
async function listDemuxGames(ticket: string): Promise<UbisoftOwnedGame[]> {
  const client = await UbisoftAcquisitionClient.connect(ticket);
  try {
    return await client.listOwnedGames();
  } finally {
    client.destroy();
  }
}
