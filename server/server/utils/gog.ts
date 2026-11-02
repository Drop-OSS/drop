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

/** getFilteredProducts rejects some query params with HTTP 500; stick to
 * the two Heroic/gogdl tooling is known to send. */
const GOG_PRODUCTS_PAGE_URL =
  "https://embed.gog.com/account/getFilteredProducts";

/**
 * Fetch the account's owned products with titles. This endpoint only
 * accepts the token as an `Authorization: Bearer` header (query-parameter
 * forms 302-redirect to the login page); the older /user/data/games
 * endpoint answers with bare numeric ids, which carry no title to search.
 */
export async function getGogLibrary(accessToken: string): Promise<GogGame[]> {
  const games: GogGame[] = [];
  const maxPages = 20;
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(GOG_PRODUCTS_PAGE_URL);
    url.searchParams.set("pageSize", "500");
    url.searchParams.set("page", String(page));
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
        statusMessage: "GOG library request failed",
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
        statusMessage: `GOG library request failed (${response.status})`,
      });
    let payload: GogProductsPage;
    try {
      payload = (await response.json()) as GogProductsPage;
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: "GOG returned an invalid library response",
      });
    }
    const products = Array.isArray(payload.products) ? payload.products : [];
    for (const product of products) games.push(...shapeGogProduct(product));
    const totalPages =
      typeof payload.totalPages === "number" ? payload.totalPages : page;
    if (products.length === 0 || page >= totalPages) break;
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
