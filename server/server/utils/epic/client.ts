import { createError } from "h3";

const EPIC_OAUTH_TOKEN_URL =
  "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";
const EPIC_ENTITLEMENTS_URL =
  "https://entitlement-public-service-prod08.ol.epicgames.com/entitlement/api/account";
const EPIC_LAUNCHER_ASSETS_URL =
  "https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public/assets/v2/platform";
// Epic's naming service. Entitlements answer "what is entitled" and say no
// names at all (live-verified: displayName is null for every row, purchased
// titles included); this endpoint is where the launcher itself reads titles
// from, and the only answer for base games.
const EPIC_CATALOG_URL =
  "https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace";
// Epic's library service: one record per product the launcher presents,
// carrying the install `appName`, the real base-game catalog item, and
// `sandboxName` - the human title. The legacy `library-public-service-*`
// hosts Heroic/Legendary grew up with are gone; this is their successor.
const EPIC_LIBRARY_URL =
  "https://library-service.live.use1a.on.epicgames.com/library/api/public/items";

// Epic launcher client, live-verified: identical to the pair Legendary's
// EPCAPI authenticates with (its predecessor answered "invalid client
// credentials" to the same probe).
const EPIC_CLIENT_ID = "34a02cf8f4414e29b15921876da36f9a";
const EPIC_CLIENT_SECRET = "daafbccc737745039dffe53d94fc76cf";

export type EpicTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  account_id: string;
  token_type: string;
};

export type EpicEntitlement = {
  id: string;
  /**
   * Epic's machine slug, not a display name: for base games it is usually
   * the catalog item id verbatim (`7ce1367f0ee846418b236dfe96d30c2c`), and
   * for add-ons a sanitized name. `displayName` is usually null; see
   * `getEpicCatalogItemNames` for where the real names live.
   */
  entitlementName: string;
  namespace: string;
  catalogItemId: string;
  grantDate: string;
  /**
   * The human title *when* Epic carries one - live-verified it usually
   * does not: the launcher entitlements endpoint returns null here for
   * every row, purchased titles included. The catalog service
   * (`getEpicCatalogItemNames`) is the real naming source.
   */
  displayName?: string;
  description?: string;
  /** EXECUTABLE / BASE_GAME / ADDON / ...; absent on older payloads. */
  entitlementType?: string;
};

/**
 * Whether an entitlement is Epic's own machinery rather than a title: the
 * launcher, the UE_ engine builds, and everything under the `ue` namespace.
 * Live-verified on a real account, that namespace holds only engine builds
 * and free marketplace content - and, in particular, dozens of hash-named
 * freebie grants whose machine names are exactly the wall of hex the depot
 * must not show. The desktop's Epic recipe skips the same set.
 */
export function isEpicRuntimeEntitlement(item: {
  entitlementName?: string;
  namespace?: string;
}): boolean {
  const name = item.entitlementName ?? "";
  return (
    name === "EpicGamesLauncher" ||
    name.startsWith("UE_") ||
    item.namespace === "ue"
  );
}

/** The entitlement types that read as titles worth listing. */
const EPIC_GAME_ENTITLEMENT_TYPES = new Set([
  "EXECUTABLE",
  "BASE_GAME",
  "ADDON",
]);

/**
 * Whether an entitlement belongs in the depot's list at all: not Epic's own
 * machinery, and not a non-game grant type either - a live account carried
 * 42 `AUDIENCE` reward rows among its 100 entitlements, which no name-based
 * filter can catch. A missing `entitlementType` is an older payload shape
 * and passes; the runtime filter still applies to it.
 */
export function isEpicGameEntitlement(item: {
  entitlementName?: string;
  namespace?: string;
  entitlementType?: string;
}): boolean {
  if (isEpicRuntimeEntitlement(item)) return false;
  return (
    !item.entitlementType ||
    EPIC_GAME_ENTITLEMENT_TYPES.has(item.entitlementType)
  );
}

/** Human-readable metadata the catalog service knows for one item. */
export type EpicCatalogName = {
  title: string;
  /** Install-API name when the catalog bothers to carry one. */
  appName?: string;
};

/**
 * What the depot lists for one entitled product. Deliberately loose: the
 * two upstreams (library service and entitlements) share only namespace,
 * catalog item id, title, and app name - everything else is best-effort.
 */
export type EpicLibraryRow = {
  namespace: string;
  catalogItemId: string;
  title: string;
  /** The install-API app name: the library service's, else the catalog's,
   * else the catalog item id (true for every UE-format title). */
  appName: string;
  entitlementName?: string;
  entitlementType?: string;
  displayName?: string;
  description?: string;
  sandboxName?: string;
};

/** One product record from Epic's library service. */
export type EpicLibraryItem = {
  namespace: string;
  catalogItemId: string;
  appName: string;
  sandboxName?: string;
  platform?: string;
  productId?: string;
  recordType?: string;
  sandboxType?: string;
};

/**
 * The rows an entitlement list becomes: everything that is not a title
 * dropped, every survivor named from the (optional) catalog-name map -
 * `entitlementName` is a machine hash for base games and showing that hash
 * as a title is exactly what the page must not do - and each carrying the
 * `appName` the ingest call will need.
 */
export function normalizeEpicEntitlements(
  entitlements: EpicEntitlement[],
  catalogNames: Record<string, EpicCatalogName> = {},
): EpicLibraryRow[] {
  return entitlements.filter(isEpicGameEntitlement).map((item) => {
    const catalog = catalogNames[item.catalogItemId];
    return {
      ...item,
      title: catalog?.title || item.displayName?.trim() || item.entitlementName,
      appName: catalog?.appName || item.catalogItemId || item.entitlementName,
    };
  });
}

/** One product record per (namespace, catalog item), Epic's machinery dropped. */
export function listableEpicLibraryItems(
  items: EpicLibraryItem[],
): EpicLibraryItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (
      isEpicRuntimeEntitlement({
        entitlementName: item.appName,
        namespace: item.namespace,
      })
    ) {
      return false;
    }
    // Fab marketplace content rides in library records too, under random
    // namespaces, with Epic's raw listing placeholder ("fab-listing-live")
    // as the sandbox name. Engine content, not games - the same policy the
    // ue namespace gets.
    if (/^fab-/i.test(item.sandboxName?.trim() ?? "")) {
      return false;
    }
    const key = `${item.namespace}/${item.catalogItemId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The product rows the library service's records become. The names are
 * Epic's own: the catalog service's when it answers (the same lookup the
 * entitlement flow uses, and the one Heroic renders), the record's
 * `sandboxName` as the free second source, the app name only as last
 * resort. One row per product however many platform records Epic carries.
 */
export function normalizeEpicLibraryItems(
  items: EpicLibraryItem[],
  catalogNames: Record<string, EpicCatalogName> = {},
): EpicLibraryRow[] {
  return listableEpicLibraryItems(items).map((item) => {
    const catalog = catalogNames[item.catalogItemId];
    return {
      namespace: item.namespace,
      catalogItemId: item.catalogItemId,
      sandboxName: item.sandboxName,
      title:
        catalog?.title ||
        item.sandboxName?.trim() ||
        item.appName ||
        item.catalogItemId,
      appName: item.appName || catalog?.appName || item.catalogItemId,
    };
  });
}

/**
 * Which items still need a name from the catalog service, grouped by the
 * namespace their catalog lookup must be scoped to, ids deduped. Takes
 * anything shaped like an entitled product - entitlement rows and library
 * records both qualify.
 */
export function collectEpicCatalogNameTargets(
  items: Array<
    Partial<EpicEntitlement> & { namespace: string; catalogItemId: string }
  >,
): Map<string, string[]> {
  const targets = new Map<string, string[]>();
  for (const item of items) {
    if (!isEpicGameEntitlement(item)) continue;
    // Epic handed the name over inline; no reason to go ask for it.
    if (item.displayName?.trim()) continue;
    if (!item.namespace || !item.catalogItemId) continue;
    const ids = targets.get(item.namespace) ?? [];
    if (!ids.includes(item.catalogItemId)) ids.push(item.catalogItemId);
    targets.set(item.namespace, ids);
  }
  return targets;
}

/** Item names never change retroactively; a day outlives any page session. */
const CATALOG_NAME_TTL_MS = 24 * 60 * 60 * 1000;
// The catalog service rate-limits aggressively and Heroic caches metadata
// for exactly that reason; low concurrency plus a small stagger keeps a
// first library load well inside the launcher's own request pattern.
const CATALOG_CONCURRENCY = 4;
const CATALOG_STAGGER_MS = 120;

const catalogNameCache = new Map<
  string,
  { at: number; value: EpicCatalogName }
>();

/**
 * Human names for entitled items, the way the launcher itself gets them:
 * one scoped bulk lookup per namespace, all of that namespace's ids as
 * repeated **singular** `id` parameters (the plural `ids=` answers an empty
 * object; live-verified), the response keyed by catalog item id with
 * `productName` falling back to `title` as the rendered name.
 *
 * Deliberately tolerant: a namespace that errors, times out, or gets
 * rate-limited simply stays out of the result, and those rows keep their
 * fallback titles. Names are cosmetic; they must never fail the library.
 */
export async function getEpicCatalogItemNames(
  targets: Map<string, string[]>,
  accessToken: string,
): Promise<Record<string, EpicCatalogName>> {
  const names: Record<string, EpicCatalogName> = {};
  const jobs: Array<{ namespace: string; ids: string[] }> = [];
  const now = Date.now();
  for (const [namespace, ids] of targets) {
    const missing: string[] = [];
    for (const id of ids) {
      const hit = catalogNameCache.get(`${namespace}/${id}`);
      if (hit && now - hit.at < CATALOG_NAME_TTL_MS) names[id] = hit.value;
      else missing.push(id);
    }
    if (missing.length > 0) jobs.push({ namespace, ids: missing });
  }

  const queue = jobs[Symbol.iterator]();
  await Promise.all(
    Array.from({ length: Math.min(CATALOG_CONCURRENCY, jobs.length) }, () =>
      (async () => {
        for (;;) {
          const job = queue.next().value as
            | { namespace: string; ids: string[] }
            | undefined;
          if (!job) return;
          const url = new URL(
            `${EPIC_CATALOG_URL}/${encodeURIComponent(job.namespace)}/bulk/items`,
          );
          for (const id of job.ids) url.searchParams.append("id", id);
          url.searchParams.set("count", String(job.ids.length + 10));
          url.searchParams.set("allow_unpublished", "true");
          url.searchParams.set("allow_free", "true");
          url.searchParams.set("country", "US");
          url.searchParams.set("locale", "en-US");
          try {
            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(10_000),
            });
            if (response.ok) {
              const items = (await response.json()) as Record<
                string,
                {
                  title?: string;
                  productName?: string;
                  appName?: string;
                } | null
              >;
              for (const [id, item] of Object.entries(items)) {
                const title = item?.productName?.trim() || item?.title?.trim();
                if (!title) continue;
                const value: EpicCatalogName = {
                  title,
                  appName: item?.appName?.trim() || undefined,
                };
                names[id] = value;
                catalogNameCache.set(`${job.namespace}/${id}`, {
                  at: Date.now(),
                  value,
                });
              }
            }
          } catch {
            // Timeout or network failure: the slug fallback stands.
          }
          await new Promise((resolve) =>
            setTimeout(resolve, CATALOG_STAGGER_MS),
          );
        }
      })(),
    ),
  );
  return names;
}

export type EpicAssetInfo = {
  appName: string;
  catalogItemId: string;
  namespace: string;
  buildVersion: string;
  distributionPoint: string;
  manifestHash?: string;
};

/**
 * Browser sign-in URL that ends on Epic's JSON redirect endpoint, whose
 * body carries the authcode the desktop launchers intercept via custom
 * scheme. Copying that code is the web-only equivalent of a launcher login.
 */
export function buildEpicAuthCodeLoginUrl(): string {
  const redirectTarget = new URL("https://www.epicgames.com/id/api/redirect");
  redirectTarget.searchParams.set("clientId", EPIC_CLIENT_ID);
  redirectTarget.searchParams.set("responseType", "code");
  const url = new URL("https://www.epicgames.com/id/login");
  url.searchParams.set("redirectUrl", redirectTarget.toString());
  return url.toString();
}

/**
 * Accept the bare code, the redirect page's URL, or the entire JSON body
 * the browser shows at /id/api/redirect (users commonly select all text).
 */
export function extractEpicAuthCode(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        code?: string;
        error?: string;
        correlationId?: string;
      };
      if (typeof parsed.code === "string" && parsed.code) return parsed.code;
      if (parsed.error || parsed.correlationId) {
        throw createError({
          statusCode: 400,
          statusMessage: `Epic's sign-in page reported an error instead of a code (${parsed.error ?? "unknown error"}${parsed.correlationId ? `, correlationId ${parsed.correlationId}` : ""}) - open the sign-in page again and copy the "code" value.`,
        });
      }
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error)
        throw error;
      // Not valid JSON; fall through to the generic handling below.
    }
  }
  if (trimmed.includes("code=")) {
    try {
      const code = new URL(trimmed).searchParams.get("code");
      if (code) return code;
    } catch {
      // Not a URL; treat as a bare code below.
    }
  }
  return trimmed;
}

/**
 * Epic answers failures with { errorCode, errorMessage } JSON - pass it
 * through, including corrective actions (device approval links), instead
 * of a bare status code.
 */
async function epicThrowFailed(
  response: Response,
  label: string,
): Promise<never> {
  const detail = await response
    .text()
    .then((body) => {
      try {
        const parsed = JSON.parse(body) as {
          errorCode?: string;
          errorMessage?: string;
          correctiveAction?: string;
          continuationUrl?: string;
        };
        const parts = [parsed.errorCode, parsed.errorMessage]
          .filter((s) => typeof s === "string" && s)
          .join(": ");
        if (parsed.correctiveAction && parsed.continuationUrl)
          return `${parts || "corrective action required"} (${parsed.correctiveAction}) - open ${parsed.continuationUrl} to approve, then retry`;
        return parts;
      } catch {
        return body.slice(0, 140);
      }
    })
    .catch(() => "");
  throw createError({
    statusCode: response.status,
    statusMessage: `${label} failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
  });
}

/**
 * Exchange an Epic authorization code (obtained from Epic login portal) for access and refresh tokens.
 */
export async function exchangeEpicAuthCode(
  input: string,
): Promise<EpicTokenResponse> {
  const code = extractEpicAuthCode(input);
  const credentials = Buffer.from(
    `${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`,
  ).toString("base64");
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    token_type: "eg1",
  });
  if (!code)
    throw createError({
      statusCode: 400,
      statusMessage:
        'Paste the "code" value from the Epic sign-in page (the whole page also works)',
    });

  let response: Response;
  try {
    response = await fetch(EPIC_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Failed to contact Epic Games authentication service",
    });
  }

  if (!response.ok)
    await epicThrowFailed(
      response,
      "Epic code exchange (the code is single-use - sign in again for a fresh one)",
    );

  return (await response.json()) as EpicTokenResponse;
}

/**
 * Refresh an expired Epic access token using a refresh token.
 */
export async function refreshEpicToken(
  refreshToken: string,
): Promise<EpicTokenResponse> {
  const credentials = Buffer.from(
    `${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`,
  ).toString("base64");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    token_type: "eg1",
  });

  let response: Response;
  try {
    response = await fetch(EPIC_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Failed to refresh Epic Games token",
    });
  }

  if (!response.ok) await epicThrowFailed(response, "Epic token refresh");

  return (await response.json()) as EpicTokenResponse;
}

/**
 * Fetch all entitled games and apps for an Epic user.
 */
export async function getEpicEntitlements(
  accountId: string,
  accessToken: string,
): Promise<EpicEntitlement[]> {
  const url = `${EPIC_ENTITLEMENTS_URL}/${encodeURIComponent(accountId)}/entitlements?start=0&count=1000`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Failed to fetch Epic entitlements",
    });
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Epic entitlements request failed (${response.status})`,
    });
  }

  return (await response.json()) as EpicEntitlement[];
}

/**
 * The account's product records, Epic's own curated list: what the
 * launcher's Library tab shows, one entry per product, carrying the real
 * install `appName` and the human `sandboxName`. Cursor-paginated.
 * Throws on any failure or unexpected shape - callers fall back to the
 * entitlement list, which is the same information wearing worse clothes.
 */
export async function getEpicLibraryItems(
  accessToken: string,
): Promise<EpicLibraryItem[]> {
  const items: EpicLibraryItem[] = [];
  let cursor: string | null = null;
  // Generous page cap: Epic's cursors run ~450 records each and even
  // decade-old accounts sit far below 25 pages, but a looping cursor
  // must not pin the request forever.
  for (let page = 0; page < 25; page++) {
    const url = new URL(EPIC_LIBRARY_URL);
    if (cursor) url.searchParams.set("cursor", cursor);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: "Failed to fetch the Epic library",
      });
    }

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: `Epic library request failed (${response.status})`,
      });
    }

    const body = (await response.json()) as {
      records?: EpicLibraryItem[];
      responseMetadata?: { nextCursor?: string | null };
    };
    if (!Array.isArray(body.records)) {
      throw createError({
        statusCode: 502,
        statusMessage: "Epic library returned an unexpected response",
      });
    }
    items.push(...body.records);
    cursor = body.responseMetadata?.nextCursor ?? null;
    if (!cursor) break;
  }
  return items;
}

/**
 * Resolve build manifest information and distribution endpoints for an Epic asset/game.
 */
export async function getEpicAssetInfo(
  platform: string,
  namespace: string,
  catalogItemId: string,
  appName: string,
  accessToken: string,
): Promise<EpicAssetInfo | null> {
  const url = `${EPIC_LAUNCHER_ASSETS_URL}/${encodeURIComponent(platform)}?namespace=${encodeURIComponent(namespace)}&catalogItemId=${encodeURIComponent(catalogItemId)}&appName=${encodeURIComponent(appName)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Failed to query Epic launcher assets API",
    });
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Epic launcher assets query failed (${response.status})`,
    });
  }

  const data = (await response.json()) as { elements?: EpicAssetInfo[] };
  return data.elements?.[0] ?? null;
}
