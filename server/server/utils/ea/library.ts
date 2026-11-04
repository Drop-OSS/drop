import { createError } from "h3";
import {
  EA_HELP_SESSION_PREFIX,
  getEaEntitlements,
  getEaHelpLibrary,
  searchEaCatalog,
  type EaEntitlement,
} from "./client";

/** Normalized row consumed by the admin depot discovery page. */
export type EaDiscoveredGame = {
  id: string;
  title: string;
  offerId?: string;
  /** True for EA Play membership titles (Help player-shell listings). */
  isEaPlay?: boolean;
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
  return { id, title, offerId };
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
  if (accessToken.startsWith(EA_HELP_SESSION_PREFIX)) {
    // Cookie-backed connection (EA grants no third-party OAuth clients):
    // the Help player-shell API lists the session's owned titles directly.
    let games: EaDiscoveredGame[];
    try {
      games = (await getEaHelpLibrary(accessToken)).map((game) => ({
        id: game.id,
        title: game.title,
        isEaPlay: game.isEaPlay,
      }));
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      throw createError({
        statusCode: statusCode === 400 ? 400 : 401,
        statusMessage:
          (error as { statusMessage?: string }).statusMessage ??
          "EA rejected the session cookies",
      });
    }
    const helpTerm = (query.title || "").trim().toLocaleLowerCase();
    const filtered = helpTerm
      ? games.filter((game) =>
          game.title.toLocaleLowerCase().includes(helpTerm),
        )
      : games;
    return { games: filtered, total: filtered.length };
  }
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
