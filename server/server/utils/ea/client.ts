import { createError } from "h3";

// UNVERIFIED-LIVE: ecommerce2 entitlement routes and the Juno GraphQL schema
// vary by client; confirm these service details against an active EA account
// before production. (OAuth itself is live-verified: connect/token accepts
// only confidential clients.)
const NUCLEUS_TOKEN_URL = "https://accounts.ea.com/connect/token";
const NUCLEUS_AUTH_URL = "https://accounts.ea.com/connect/auth";
const ENTITLEMENTS_URL =
  "https://ecommerce2.dm.origin.com/ecommerce2/entitlements";
const JUNO_GRAPHQL_URL = "https://gateway.ea.com/proxy/identity/pids/me";

/**
 * EA grants no public OAuth clients: live probing of connect/token answers
 * `invalid_client / unknown client` for launcher-style public ids, unlike
 * GOG's Galaxy client. Browser sign-in for EA therefore works only with a
 * confidential OAuth client (id + secret + registered redirect) that the
 * deployment provides; without one the EA tab falls back to pasting
 * launcher-issued tokens.
 */
export type EaOauthClient = { id: string; secret: string; redirectUri: string };

export function eaConfiguredClient(): EaOauthClient | null {
  const id = process.env.EA_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.EA_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.EA_OAUTH_REDIRECT_URI?.trim();
  return id && secret && redirectUri ? { id, secret, redirectUri } : null;
}

const EA_LOGIN_SCOPE =
  "basic user.identity userinfo.persona userinfo.accountprofile user.relation.usergroups";
export type EaTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  pid?: { pidId?: string };
  [key: string]: unknown;
};
export type EaEntitlement = {
  entitlementId?: string;
  offerId?: string;
  productId?: string;
  displayName?: string;
  grantDate?: string;
  [key: string]: unknown;
};
export type EaCatalogProduct = {
  offerId: string;
  offerName?: string;
  masterTitleId?: string;
  [key: string]: unknown;
};
function form(
  fields: Record<string, string>,
  clientId?: string,
  clientSecret?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  const body: Record<string, string> = { ...fields };
  if (clientId && clientSecret)
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  else if (clientId)
    // Form client_id for clients without a secret. Live probing showed EA
    // rejects every such public id ("unknown client"), but the generic
    // exchange helpers keep supporting it for configured clients.
    body.client_id = clientId;
  return { headers, body: new URLSearchParams(body).toString() };
}
async function eaFetch(
  url: string,
  init: RequestInit,
  label: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to contact EA ${label}`,
    });
  }
  if (!response.ok)
    throw createError({
      statusCode: response.status,
      statusMessage: `EA ${label} request failed (${response.status})`,
    });
  return response;
}
function tokenShape(raw: unknown): EaTokenResponse {
  if (
    !raw ||
    typeof raw !== "object" ||
    typeof (raw as EaTokenResponse).access_token !== "string" ||
    typeof (raw as EaTokenResponse).expires_in !== "number" ||
    !Number.isFinite((raw as EaTokenResponse).expires_in)
  ) {
    throw createError({
      statusCode: 502,
      statusMessage: "EA returned an invalid OAuth token response",
    });
  }
  return raw as EaTokenResponse;
}
/** Exchange a Nucleus authorization code; secretless when the client is public. */
export async function exchangeEaAuthorizationCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret?: string,
): Promise<EaTokenResponse> {
  if (!code.trim() || !clientId)
    throw createError({
      statusCode: 400,
      statusMessage: "EA authorization code and OAuth client id are required",
    });
  const request = form(
    { grant_type: "authorization_code", code, redirect_uri: redirectUri },
    clientId,
    clientSecret,
  );
  const response = await eaFetch(
    NUCLEUS_TOKEN_URL,
    { method: "POST", headers: request.headers, body: request.body },
    "Nucleus authentication",
  );
  return tokenShape(await response.json());
}
/** Refresh a token; the caller must persist a rotated refresh_token if returned. */
export async function refreshEaToken(
  refreshToken: string,
  clientId: string,
  clientSecret?: string,
): Promise<EaTokenResponse> {
  if (!refreshToken || !clientId)
    throw createError({
      statusCode: 400,
      statusMessage: "EA refresh token and OAuth client id are required",
    });
  const request = form(
    { grant_type: "refresh_token", refresh_token: refreshToken },
    clientId,
    clientSecret,
  );
  const response = await eaFetch(
    NUCLEUS_TOKEN_URL,
    { method: "POST", headers: request.headers, body: request.body },
    "Nucleus token refresh",
  );
  return tokenShape(await response.json());
}

/**
 * Browser sign-in URL for EA's own login page (handles 2FA/captchas
 * natively). Only offered when the deployment configures a confidential
 * EA OAuth client; after sign-in the browser lands on the client's
 * registered redirect, whose code the admin copies back.
 */
export function buildEaLoginUrl(): string | null {
  const client = eaConfiguredClient();
  if (!client) return null;
  const url = new URL(NUCLEUS_AUTH_URL);
  url.searchParams.set("client_id", client.id);
  url.searchParams.set("redirect_uri", client.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", EA_LOGIN_SCOPE);
  return url.toString();
}

/** Accept a bare code or the full `<redirect>?code=X` URL from the address bar. */
export function extractEaAuthCode(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("code=")) {
    try {
      // Custom-scheme redirects (code://...) are not URL-parseable; swap the
      // scheme for a dummy https origin to read the query.
      const parsed = new URL(
        /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
          ? trimmed.replace(
              /^[a-z][a-z0-9+.-]*:\/\//i,
              "https://redirect.invalid/",
            )
          : trimmed,
      );
      const code = parsed.searchParams.get("code");
      if (code) return code;
    } catch {
      // Not parseable as a URL; treat the input as a bare code below.
    }
  }
  return trimmed;
}

/**
 * Redeem a copied sign-in code with the configured confidential client.
 * The configured client's id, secret and redirect must match what the
 * authorization URL used, which buildEaLoginUrl guarantees.
 */
export async function exchangeEaLoginCode(
  input: string,
): Promise<EaTokenResponse> {
  const client = eaConfiguredClient();
  if (!client)
    throw createError({
      statusCode: 400,
      statusMessage:
        "EA sign-in needs EA_OAUTH_CLIENT_ID/EA_OAUTH_CLIENT_SECRET/EA_OAUTH_REDIRECT_URI configured on the server - or paste tokens instead",
    });
  const code = extractEaAuthCode(input);
  if (!code)
    throw createError({
      statusCode: 400,
      statusMessage: "Paste the code from the EA sign-in redirect",
    });
  return exchangeEaAuthorizationCode(
    code,
    client.redirectUri,
    client.id,
    client.secret,
  );
}
/**
 * EA's own web-identity endpoint: exchanges an `sid` cookie from an ea.com
 * browser session for an EA JWT. No OAuth client involved, so it works for
 * accounts the confidential-client path cannot serve (EA grants none to
 * third parties). Anonymous probes answer 200 with an empty body; the JWT
 * and user id only appear with a live session cookie.
 */
const EA_SESSION_AUTH_URL = "https://signin.ea.com/p/identitynucleus/xhr/auth";

export type EaSession = {
  jwt: string;
  userId: string;
  expiresAt: Date | null;
};

/** Unverified JWT expiry claim - only used to schedule re-exchange. */
export function eaJwtExpiry(token: string): Date | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: number };
    return typeof claims.exp === "number" && Number.isFinite(claims.exp)
      ? new Date(claims.exp * 1000)
      : null;
  } catch {
    return null;
  }
}

/**
 * Exchange the ea.com `sid` session cookie for an EA JWT. The connection
 * keeps the cookie as its renewing credential: the short-lived JWT is
 * re-minted from it until EA kills the cookie itself, at which point the
 * user pastes a fresh one.
 */
export async function exchangeEaSessionCookie(sid: string): Promise<EaSession> {
  const cookie = sid.trim();
  if (!cookie)
    throw createError({
      statusCode: 400,
      statusMessage: "Paste the ea.com session cookie (sid) value",
    });
  const url = new URL(EA_SESSION_AUTH_URL);
  url.searchParams.set("isAjax", "true");
  const response = await eaFetch(
    url.toString(),
    {
      headers: {
        Accept: "application/json",
        Cookie: `sid=${cookie}`,
      },
    },
    "session sign-in",
  );
  const raw = (await response.json().catch(() => null)) as unknown;
  const root =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const bag =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const jwt =
    typeof bag.jwt === "string"
      ? bag.jwt
      : typeof bag.token === "string"
        ? bag.token
        : null;
  const userId =
    typeof bag.user_id === "string" || typeof bag.user_id === "number"
      ? String(bag.user_id)
      : "";
  if (!jwt)
    throw createError({
      statusCode: 401,
      statusMessage:
        "EA gave no session token for that cookie - sign in to ea.com in your browser, then copy the sid cookie value afresh",
    });
  return { jwt, userId, expiresAt: eaJwtExpiry(jwt) };
}

/** Return one bounded entitlement page. */
export async function getEaEntitlements(
  accessToken: string,
  start = 0,
  count = 1000,
): Promise<EaEntitlement[]> {
  if (
    !accessToken ||
    !Number.isSafeInteger(start) ||
    start < 0 ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 1000
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid EA entitlement query",
    });
  const url = new URL(ENTITLEMENTS_URL);
  url.searchParams.set("start", String(start));
  url.searchParams.set("count", String(count));
  url.searchParams.set("access_token", accessToken);
  const data = (await (
    await eaFetch(
      url.toString(),
      { headers: { Accept: "application/json" } },
      "entitlements",
    )
  ).json()) as unknown;
  if (Array.isArray(data)) return data as EaEntitlement[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { entitlements?: unknown }).entitlements)
  )
    return (data as { entitlements: EaEntitlement[] }).entitlements;
  throw createError({
    statusCode: 502,
    statusMessage: "EA returned an invalid entitlement list",
  });
}
/** Resolve the account pid for a token; used as the stored EA accountId. */
export async function fetchEaPid(accessToken: string): Promise<string> {
  if (!accessToken)
    throw createError({
      statusCode: 400,
      statusMessage: "An EA access token is required",
    });
  const response = await eaFetch(
    JUNO_GRAPHQL_URL,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
    "identity profile",
  );
  const data = (await response.json()) as { person?: { pid?: number } };
  if (typeof data?.person?.pid !== "number")
    throw createError({
      statusCode: 502,
      statusMessage: "EA returned an invalid identity profile",
    });
  return String(data.person.pid);
}
/** Search Juno's GraphQL catalog. Operation/fields are provisional pending live verification. */
export async function searchEaCatalog(
  accessToken: string,
  searchTerm: string,
): Promise<EaCatalogProduct[]> {
  if (!accessToken || !searchTerm.trim())
    throw createError({
      statusCode: 400,
      statusMessage: "EA access token and catalog search term are required",
    });
  // UNVERIFIED-LIVE: Juno GraphQL operation and result shape are modeled on observed catalog conventions.
  const query =
    "query SearchOffers($searchTerm: String!) { offers(searchTerm: $searchTerm) { offerId offerName masterTitleId } }";
  const response = await eaFetch(
    JUNO_GRAPHQL_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { searchTerm } }),
    },
    "Juno catalog",
  );
  const payload = (await response.json()) as {
    data?: { offers?: unknown };
    errors?: unknown[];
  };
  if (payload.errors?.length)
    throw createError({
      statusCode: 502,
      statusMessage: "EA Juno catalog query returned GraphQL errors",
    });
  if (!Array.isArray(payload.data?.offers))
    throw createError({
      statusCode: 502,
      statusMessage: "EA Juno returned an invalid catalog response",
    });
  return payload.data.offers.filter(
    (item): item is EaCatalogProduct =>
      !!item &&
      typeof item === "object" &&
      typeof (item as EaCatalogProduct).offerId === "string",
  );
}
