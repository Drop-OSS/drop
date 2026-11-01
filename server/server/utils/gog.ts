import { createError } from "h3";

const GOG_LIBRARY_URL = "https://embed.gog.com/user/data/games";
const GOG_TOKEN_URL = "https://auth.gog.com/token";
const GOG_AUTH_URL = "https://auth.gog.com/auth";

/**
 * GOG's Galaxy/embed public OAuth client. The pair is embedded unencrypted
 * in GOG's own launcher and is the same one used by gogrepo, gogcli and
 * similar open-source tools; it exists so third-party apps can use a user's
 * own refreshed tokens, which is exactly its use here.
 */
const GOG_PUBLIC_CLIENT_ID = "46f441d2-5409-4a03-95fd-39285c9db1c1";
const GOG_PUBLIC_CLIENT_SECRET = "884406289756227531";

export type GogTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  user_id?: string;
};

/**
 * Build GOG's sign-in URL. GOG's public Galaxy client accepts a localhost
 * redirect, which is how gogcli and Heroic complete the flow; this server
 * uses its own callback URL so the code can be exchanged without a desktop
 * launcher in the loop.
 */
export function buildGogAuthorizeUrl(
  redirectUri: string,
  state: string,
): string {
  const url = new URL(GOG_AUTH_URL);
  url.searchParams.set("client_id", GOG_PUBLIC_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "all");
  url.searchParams.set("state", state);
  return url.toString();
}

/** Exchange the sign-in callback's code for a token set. */
export async function exchangeGogAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<GogTokenResponse> {
  if (!code)
    throw createError({
      statusCode: 400,
      statusMessage: "A GOG authorization code is required",
    });
  const url = new URL(GOG_TOKEN_URL);
  url.searchParams.set("client_id", GOG_PUBLIC_CLIENT_ID);
  url.searchParams.set("client_secret", GOG_PUBLIC_CLIENT_SECRET);
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("code", code);
  url.searchParams.set("redirect_uri", redirectUri);
  const response = await gogTokenFetch(url, "GOG code exchange");
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
  if (!response.ok)
    throw createError({
      statusCode: response.status,
      statusMessage: `${label} failed (${response.status})`,
    });
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

type GogResponse = {
  owned?: unknown[];
  games?: unknown[];
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

/** Fetches the authenticated user's owned titles from the GOG Galaxy embed API. */
export async function getGogLibrary(accessToken: string): Promise<GogGame[]> {
  const url = new URL(GOG_LIBRARY_URL);
  url.searchParams.set("access_token", accessToken);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "GOG library request failed",
    });
  }
  if (response.status === 401 || response.status === 403) {
    throw createError({
      statusCode: response.status,
      statusMessage: "GOG access token is invalid or expired",
    });
  }
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `GOG library request failed (${response.status})`,
    });
  }

  let payload: GogResponse;
  try {
    payload = (await response.json()) as GogResponse;
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "GOG returned an invalid library response",
    });
  }
  const records = Array.isArray(payload.owned)
    ? payload.owned
    : Array.isArray(payload.games)
      ? payload.games
      : [];
  return records.flatMap((record): GogGame[] => {
    if (!record || typeof record !== "object") return [];
    const item = record as Record<string, unknown>;
    const rawId = item.id ?? item.gameId;
    const rawTitle = item.title ?? item.name;
    if (!isValidGogGameId(rawId) || typeof rawTitle !== "string") return [];
    const rawPlatforms = item.worksOn ?? item.platforms;
    const platforms = Array.isArray(rawPlatforms)
      ? rawPlatforms.filter(
          (platform): platform is string => typeof platform === "string",
        )
      : undefined;
    return [
      {
        ...item,
        id: String(rawId),
        title: rawTitle,
        ...(platforms ? { worksOn: platforms, platforms } : {}),
      },
    ];
  });
}
