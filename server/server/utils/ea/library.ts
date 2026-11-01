import { createError } from "h3";
import {
  getEaEntitlements,
  searchEaCatalog,
  type EaEntitlement,
} from "./client";

/** Normalized row consumed by the admin depot discovery page. */
export type EaDiscoveredGame = {
  id: string;
  title: string;
  offerId?: string;
  /** EA's per-entitlement archive URL, when the API includes one. */
  downloadLink?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Map one entitlement onto the discovery shape. EA's live documents nest the
 * useful fields under `entitlementInfo`/`baseGames`; the ported client type
 * is flat and provisional, so both layouts are accepted here.
 */
export function normalizeEaGame(item: EaEntitlement): EaDiscoveredGame {
  const nested = asRecord(asRecord(item).entitlementInfo);
  const source = Object.keys(nested).length ? nested : asRecord(item);
  const base = asRecord(
    Array.isArray(source.baseGames) ? source.baseGames[0] : undefined,
  );
  const offerId = str(source.offerId) ?? str(base.offerId);
  const id =
    str(base.id) ??
    str(source.productId) ??
    str(source.entitlementId) ??
    str(source.id) ??
    offerId ??
    "";
  const title =
    str(base.name) ??
    str(source.displayName) ??
    str(source.appName) ??
    offerId ??
    "Untitled";
  return {
    id,
    title,
    offerId,
    downloadLink: str(base.downloadLink) ?? str(source.downloadLink),
  };
}

export type EaDiscoveryQuery = {
  /** Case-insensitive filter applied to owned entitlements. */
  title?: string;
  /** Additional Juno catalog search merged over the owned list. */
  search?: string;
};

/**
 * List the titles the token's account owns, optionally widening the result
 * with a Juno catalog search. The catalog operation is UNVERIFIED-LIVE (see
 * searchEaCatalog), so a failing or oddly-shaped catalog response degrades to
 * the owned entitlements instead of failing the whole discovery request.
 */
export async function discoverEaLibrary(
  accessToken: string,
  query: EaDiscoveryQuery = {},
): Promise<{ games: EaDiscoveredGame[]; total: number }> {
  let entitlements: EaEntitlement[];
  try {
    entitlements = await getEaEntitlements(accessToken);
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    throw createError({
      statusCode: statusCode === 401 || statusCode === 403 ? statusCode : 502,
      statusMessage:
        statusCode === 401 || statusCode === 403
          ? "EA rejected the access token"
          : "Unable to retrieve EA entitlements",
    });
  }

  const term = (query.search || query.title || "").trim().toLocaleLowerCase();
  const owned = entitlements.map(normalizeEaGame).filter((game) => {
    if (!game.id) return false;
    if (!term) return true;
    return (
      game.title.toLocaleLowerCase().includes(term) ||
      (game.offerId ?? "").toLocaleLowerCase().includes(term)
    );
  });

  if (!term) return { games: owned, total: owned.length };

  try {
    const offers = await searchEaCatalog(accessToken, term);
    const ownedOffers = new Set(
      owned.map((game) => game.offerId).filter(Boolean),
    );
    const catalogOnly = offers
      .map((offer) => ({
        id: offer.offerId,
        title: offer.offerName ?? offer.offerId,
        offerId: offer.offerId,
      }))
      .filter((game) => !ownedOffers.has(game.offerId));
    const games = [...owned, ...catalogOnly];
    return { games, total: games.length };
  } catch {
    // Degraded but honest: owned titles are verified, catalog results are not.
    return { games: owned, total: owned.length };
  }
}
