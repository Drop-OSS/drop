import { createError } from "h3";

const GOG_TOKEN_URL = "https://auth.gog.com/token";
const GOG_AUTH_URL = "https://auth.gog.com/auth";

/**
 * The GOG client Heroic's bundled gogdl binary authenticates under - the
 * same pair that issued the working tokens in Heroic's gog_store/auth.json.
 * Live-verified against auth.gog.com: dummy codes reach code validation
 * ("invalid_grant"), while other public pairs GOG once tolerated now fail
 * client auth outright ("The client credentials are invalid").
 */
const GOG_PUBLIC_CLIENT_ID = "46899977096215655";
const GOG_PUBLIC_CLIENT_SECRET =
  "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9";

/**
 * The only redirect this client is registered for (live-verified; every
 * other redirect - localhost callbacks included - yields GOG's
 * "invalid client" page). Sign-in therefore ends on
 * embed.gog.com/on_login_success?origin=client&code=... and the code is
 * copied back, the gogdl flow Heroic itself automates.
 */
const GOG_EMBED_REDIRECT_URI =
  "https://embed.gog.com/on_login_success?origin=client";

export type GogTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  user_id?: string;
};

/** GOG's sign-in URL for the Heroic/gogdl client (see the redirect note). */
export function buildGogAuthorizeUrl(): string {
  const url = new URL(GOG_AUTH_URL);
  url.searchParams.set("client_id", GOG_PUBLIC_CLIENT_ID);
  url.searchParams.set("redirect_uri", GOG_EMBED_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("layout", "galaxy");
  return url.toString();
}

/**
 * Accept a bare code or the full `embed.gog.com/on_login_success?...&code=...`
 * URL copied from the address bar after sign-in.
 */
export function extractGogAuthCode(input: string): string {
  const trimmed = input.trim();
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

/** Exchange the sign-in code for a token set. */
export async function exchangeGogAuthorizationCode(
  input: string,
): Promise<GogTokenResponse> {
  const code = extractGogAuthCode(input);
  if (!code)
    throw createError({
      statusCode: 400,
      statusMessage:
        "Paste the code from the embed.gog.com/on_login_success page (or its full URL)",
    });
  const url = new URL(GOG_TOKEN_URL);
  url.searchParams.set("client_id", GOG_PUBLIC_CLIENT_ID);
  url.searchParams.set("client_secret", GOG_PUBLIC_CLIENT_SECRET);
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("code", code);
  url.searchParams.set("redirect_uri", GOG_EMBED_REDIRECT_URI);
  const response = await gogTokenFetch(
    url,
    "GOG code exchange (the code is single-use - fetch a fresh one)",
  );
  return gogTokenShape(await response.json());
}

async function gogTokenFetch(url: URL, label: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to contact ${label}`,
    });
  }
  if (!response.ok) {
    // GOG explains rejections as {"error":...,"error_description":...};
    // pass that through - swallowing it turns every failure into a guess.
    const detail = await response
      .text()
      .then((body) => {
        try {
          const parsed = JSON.parse(body) as {
            error_description?: string;
            error?: string;
          };
          return parsed.error_description || parsed.error || "";
        } catch {
          return body.slice(0, 140);
        }
      })
      .catch(() => "");
    throw createError({
      statusCode: response.status,
      statusMessage: `${label} failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    });
  }
  return response;
}

function gogTokenShape(raw: unknown): GogTokenResponse {
  const tokens = raw as GogTokenResponse;
  if (
    !tokens ||
    typeof tokens.access_token !== "string" ||
    typeof tokens.expires_in !== "number"
  )
    throw createError({
      statusCode: 502,
      statusMessage: "GOG returned an invalid token response",
    });
  return tokens;
}

/** Renew a GOG access token from its refresh token (launcher-style flow). */
export async function refreshGogToken(
  refreshToken: string,
): Promise<GogTokenResponse> {
  if (!refreshToken)
    throw createError({
      statusCode: 400,
      statusMessage: "A GOG refresh token is required",
    });
  const url = new URL(GOG_TOKEN_URL);
  url.searchParams.set("client_id", GOG_PUBLIC_CLIENT_ID);
  url.searchParams.set("client_secret", GOG_PUBLIC_CLIENT_SECRET);
  url.searchParams.set("grant_type", "refresh_token");
  url.searchParams.set("refresh_token", refreshToken);
  const response = await gogTokenFetch(url, "GOG token refresh");
  return gogTokenShape(await response.json());
}

type GogProductsPage = {
  products?: unknown[];
  totalPages?: number;
  page?: number;
};

export type GogGame = {
  id: string;
  title: string;
  worksOn?: string[];
  platforms?: string[];
  [key: string]: unknown;
};

export function isValidGogGameId(value: unknown): value is string | number {
  return (
    (typeof value === "string" && /^\d{1,20}$/.test(value)) ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
  );
}

/**
 * The owned-games flow as the GOG API documentation (gogapidocs.readthedocs
 * .io) describes it, under "Account Management → Games & Movies" and
 * "Listing". Three endpoints, exactly the three the docs name:
 *
 *   GET /user/data/games                    - "List of games and movies the
 *                                             account owns." Ids only.
 *   GET /account/getFilteredProducts        - "Searches for products owned
 *                                             by the user." Titled, paged;
 *                                             the docs send it `mediaType=1`
 *                                             and point here from the id
 *                                             list ("for more than just the
 *                                             IDs").
 *   GET /account/gameDetails/<id>.json      - one product's details, title
 *                                             and downloads included.
 *
 * The titled list is the spine; the id list is the completeness anchor,
 * because it also carries products the filtered list deliberately omits -
 * DLC, bundle SKUs, soundtracks, delisted leftovers. The details endpoint
 * is the arbiter: GOG answers it with `[]` for every one of those (live
 * verified) and with a titled product only for a real game, which is the
 * signal to add a row. No undocumented query params: getFilteredProducts
 * answers some with HTTP 500, and the documented pair below is verified
 * good - the unflagged product list is already the union of hidden and
 * visible, so no hiddenFlag is needed.
 */
const GOG_OWNED_IDS_URL = "https://embed.gog.com/user/data/games";
const GOG_PRODUCTS_PAGE_URL =
  "https://embed.gog.com/account/getFilteredProducts";
const GOG_GAME_DETAILS_URL = "https://embed.gog.com/account/gameDetails/";

/** GET a GOG account endpoint with the Bearer header and read its JSON.
 * These endpoints take the token in the header only (query-parameter forms
 * 302-redirect to the login page), and a redirect or 401/403 there means
 * the connection needs signing in again - not a retry. */
async function gogAccountJson(
  url: string | URL,
  accessToken: string,
  failureMessage: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: failureMessage,
    });
  }
  if (
    response.status === 302 ||
    response.status === 401 ||
    response.status === 403
  )
    throw createError({
      statusCode: 403,
      statusMessage: "GOG rejected the access token - sign in again",
    });
  if (!response.ok)
    throw createError({
      statusCode: 502,
      statusMessage: `${failureMessage} (${response.status})`,
    });
  try {
    return await response.json();
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: `${failureMessage} - invalid response`,
    });
  }
}

/** The documented "List of games and movies the account owns", ids widened
 * to strings. */
async function getGogOwnedIds(accessToken: string): Promise<string[]> {
  const body = (await gogAccountJson(
    GOG_OWNED_IDS_URL,
    accessToken,
    "GOG owned-ids request failed",
  )) as { owned?: unknown };
  return Array.isArray(body.owned)
    ? body.owned.filter(isValidGogGameId).map(String)
    : [];
}

/**
 * One owned product the filtered list did not carry, through the documented
 * per-product endpoint. `[]` is GOG's own verdict of "not a game product"
 * (DLC, bundles, extras, delisted), anything else has to carry a title and
 * a downloads list to earn a row. Failure costs one row, never the library.
 */
async function gogOwnedGameDetails(
  productId: string,
  accessToken: string,
): Promise<GogGame | null> {
  let details: unknown;
  try {
    details = await gogAccountJson(
      `${GOG_GAME_DETAILS_URL}${productId}.json`,
      accessToken,
      "GOG product details request failed",
    );
  } catch {
    return null;
  }
  if (
    !details ||
    typeof details !== "object" ||
    Array.isArray(details) ||
    typeof (details as GogGame).title !== "string" ||
    !Array.isArray((details as { downloads?: unknown }).downloads) ||
    (details as { downloads: unknown[] }).downloads.length === 0
  ) {
    return null;
  }
  return {
    ...(details as Record<string, unknown>),
    id: productId,
    title: (details as GogGame).title,
  };
}

/** The titled product pages, followed until `totalPages` runs out. */
async function getGogEntitledProducts(accessToken: string): Promise<GogGame[]> {
  const games: GogGame[] = [];
  const maxPages = 20;
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(GOG_PRODUCTS_PAGE_URL);
    url.searchParams.set("mediaType", "1");
    url.searchParams.set("page", String(page));
    const body = (await gogAccountJson(
      url,
      accessToken,
      "GOG library request failed",
    )) as GogProductsPage;
    const products = Array.isArray(body.products) ? body.products : [];
    for (const product of products) games.push(...shapeGogProduct(product));
    const totalPages =
      typeof body.totalPages === "number" ? body.totalPages : page;
    if (products.length === 0 || page >= totalPages) break;
  }
  return games;
}

/**
 * The account's owned games: the documented entitled-products list, topped
 * up with anything the documented owned-ids list claims but the filtered
 * view hid and the details endpoint still describes as a game.
 */
export async function getGogLibrary(accessToken: string): Promise<GogGame[]> {
  const [ownedIds, games] = await Promise.all([
    // The ids anchor is worth a top-up, never worth a failed page: if the
    // extra call breaks, the spine below is still the whole answer.
    getGogOwnedIds(accessToken).catch(() => null),
    getGogEntitledProducts(accessToken),
  ]);
  if (!ownedIds || ownedIds.length === 0) return games;
  const listed = new Set(games.map((game) => game.id));
  // Ordered account endpoints, small bursts, bounded: even a decade of
  // giveaway DLC sits under this cap, and one page of details per missing
  // product keeps the admin page a request storm short of GOG's patience.
  const missing = ownedIds.filter((id) => !listed.has(id)).slice(0, 120);
  for (const id of missing) {
    const game = await gogOwnedGameDetails(id, accessToken);
    if (game) games.push(game);
  }
  return games;
}

function shapeGogProduct(record: unknown): GogGame[] {
  if (!record || typeof record !== "object") return [];
  const item = record as Record<string, unknown>;
  if (!isValidGogGameId(item.id) || typeof item.title !== "string") return [];
  // getFilteredProducts reports platforms as { Windows: true, Mac: false, ... }.
  const flags = item.worksOn;
  const platforms =
    flags && typeof flags === "object" && !Array.isArray(flags)
      ? Object.entries(flags as Record<string, unknown>)
          .filter(([, supported]) => supported === true)
          .map(([platform]) => platform.toLowerCase())
      : undefined;
  return [
    {
      ...item,
      id: String(item.id),
      title: item.title,
      ...(platforms ? { worksOn: platforms, platforms } : {}),
    },
  ];
}
