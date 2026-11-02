import { createError } from "h3";

const EPIC_OAUTH_TOKEN_URL =
  "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";
const EPIC_ENTITLEMENTS_URL =
  "https://entitlement-public-service-prod08.ol.epicgames.com/entitlement/api/account";
const EPIC_LAUNCHER_ASSETS_URL =
  "https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public/assets/v2/platform";

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
  entitlementName: string;
  namespace: string;
  catalogItemId: string;
  grantDate: string;
};

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
