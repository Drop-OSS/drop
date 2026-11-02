import { createError } from "h3";
import { randomUUID } from "node:crypto";

const UBISOFT_SESSIONS_URL =
  "https://public-ubiservices.ubi.com/v3/profiles/sessions";
/**
 * The Ubisoft Connect launcher's own GraphQL gateway. Extracted from the
 * launcher's public UI bundle (connect.cdn.ubisoft.com/library/2.47.0) and
 * verified live against a real account in Nov 2026: it answers the stored
 * session ticket and returns the entitled list with names. The former
 * /v1/profiles/{uid}/ownedtitles route is gone - it 404s on both the classic
 * and the cert2 service gateways.
 */
const UBISOFT_GRAPHQL_URL =
  "https://public-ubiservices.ubi.com/v1/profiles/me/uplay/graphql";
const UBISOFT_OWNED_GAMES_QUERY =
  "{ viewer { games { nodes { id spaceId name releaseDate } } } }";
/**
 * Legacy HTTP product-config/manifest hosts (api-uplayv2.ubi.com,
 * uplaypc-dns.ubi.com) were probed dead in Nov 2026 - DNS no longer
 * resolves. Install acquisition lives on the demux socket
 * (utils/ubisoft/demux/) since then.
 */

/**
 * Public Ubisoft Connect PC client application identifier (widely published
 * constant, equivalent in role to the Epic client credentials).
 */
const UBISOFT_APP_ID = "3ad0af50-b1e5-4e5f-8c69-b1b17d3a4e9a";

/**
 * Application id used for the v3 sessions (login/2FA/remember-me) flow.
 * Live-verified 2026-11: the web club app id (82b650c0-...) sits behind
 * Ubisoft's DataDome bot protection, which answers server-side logins with
 * a 403 captcha page before credentials are ever checked; this id reaches
 * the real auth service (dummy credentials correctly return 401 "Invalid
 * credentials") and is the one ubisoft-demux-node's HTTP helper uses.
 */
const UBISOFT_SESSION_APP_ID = "f68a4bb5-608a-4ff2-8123-be8ef797e0a6";

/**
 * Plain client marker: the sessions API accepts any non-browser client
 * under this app id, so there is no need to impersonate a browser.
 */
const UBISOFT_LOGIN_USER_AGENT = "GameDepot/1.0 (Ubisoft Connect sessions API)";

export type UbisoftSession = {
  ticket: string;
  sessionId: string;
  userId: string;
  username?: string;
  nameOnPlatform?: string;
  expiration?: string;
  serverTime?: string;
  /** Long-lived ticket that re-opens sessions without the password. */
  rememberMeTicket?: string;
  profiles?: { nameOnPlatform?: string }[];
  platformType?: string;
};

/** Ubisoft demanded a 2FA code; the caller must supply one. */
export type UbisoftTwoFactorRequired = {
  twoFactorRequired: true;
  twoFactorTicket: string;
  method: string;
};

export type UbisoftLoginResult = UbisoftSession | UbisoftTwoFactorRequired;

export type UbisoftOwnedTitle = {
  id?: string;
  spaceId: string;
  name?: string;
  releaseDate?: string;
};

function ubiHeaders(
  ticket?: string,
  appId: string = UBISOFT_APP_ID,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Ubi-AppId": appId,
    "Ubi-RequestedPlatformType": "uplaypc",
    "Content-Type": "application/json",
  };
  if (ticket) {
    // Ubisoft session tickets travel as `Ubi_v1 t=<ticket>`; never log them.
    headers["Authorization"] = `Ubi_v1 t=${ticket}`;
  }
  return headers;
}

async function ubiFetch(
  url: string,
  init: RequestInit,
  failureMessage: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: failureMessage });
  }
  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `${failureMessage} (${response.status})`,
    });
  }
  return response;
}

/**
 * Create a Ubisoft Connect session from account credentials.
 * Equivalent to `authorize` in the shared adapter contract.
 *
 * Ubisoft's v3 sessions endpoint may answer the credential POST with a
 * `Ubi-Challenge` nonce that must be echoed back on a retry (a device
 * check, not 2FA), or with a two-factor challenge instead of a ticket;
 * both are handled here. The password is used for this request only -
 * the returned remember-me ticket renews the session from then on.
 */
export async function createUbisoftSession(
  email: string,
  password: string,
): Promise<UbisoftLoginResult> {
  const basic = Buffer.from(`${email}:${password}`).toString("base64");
  const headers: Record<string, string> = {
    ...sessionAuthHeaders(),
    Authorization: `Basic ${basic}`,
  };
  let attempt = await ubisoftSessionPost(headers);
  if (attempt.challenge && !isUbisoftTwoFactorBody(attempt.body)) {
    attempt = await ubisoftSessionPost({
      ...headers,
      "Ubi-Challenge": attempt.challenge,
    });
  }
  if (isUbisoftTwoFactorBody(attempt.body)) {
    return {
      twoFactorRequired: true,
      twoFactorTicket: attempt.body.twoFactorAuthenticationTicket,
      method:
        typeof attempt.body.twoFactorAuthenticationMethod === "string"
          ? attempt.body.twoFactorAuthenticationMethod
          : "unknown",
    };
  }
  return readUbisoftSession(attempt, "Ubisoft rejected the email or password");
}

/** Exchange the 2FA challenge's ticket plus a code for a real session. */
export async function completeUbisoftTwoFactor(
  code: string,
  twoFactorTicket: string,
): Promise<UbisoftSession> {
  if (!code || !twoFactorTicket)
    throw createError({
      statusCode: 400,
      statusMessage: "A Ubisoft 2FA code and challenge ticket are required",
    });
  const attempt = await ubisoftSessionPost({
    ...sessionAuthHeaders(),
    Authorization: `ubi_2fa_v1 t=${twoFactorTicket}`,
    "Ubi-2FACode": code,
  });
  return readUbisoftSession(attempt, "The Ubisoft 2FA code was rejected");
}

/**
 * Re-open a session with a long-lived remember-me ticket (`rm_v1`), the
 * Ubisoft equivalent of a refresh-token login: no password involved.
 */
export async function loginUbisoftWithRememberTicket(
  rememberTicket: string,
): Promise<UbisoftSession> {
  if (!rememberTicket)
    throw createError({
      statusCode: 400,
      statusMessage: "A Ubisoft remember-me ticket is required",
    });
  const attempt = await ubisoftSessionPost({
    ...sessionAuthHeaders(),
    Authorization: `rm_v1 t=${rememberTicket}`,
  });
  return readUbisoftSession(
    attempt,
    "The Ubisoft remember-me ticket was rejected - sign in again",
  );
}

function sessionAuthHeaders(): Record<string, string> {
  return {
    "Ubi-AppId": UBISOFT_SESSION_APP_ID,
    "Content-Type": "application/json",
    "User-Agent": UBISOFT_LOGIN_USER_AGENT,
  };
}

type UbisoftSessionAttempt = {
  status: number;
  body: Record<string, unknown>;
  challenge: string | null;
};

async function ubisoftSessionPost(
  headers: Record<string, string>,
): Promise<UbisoftSessionAttempt> {
  let response: Response;
  try {
    response = await fetch(UBISOFT_SESSIONS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ rememberMe: true }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Failed to contact Ubisoft Connect authentication service",
    });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Error pages are not JSON; the status code below carries the verdict.
  }
  return {
    status: response.status,
    body,
    challenge: response.headers.get("Ubi-Challenge"),
  };
}

function isUbisoftTwoFactorBody(
  body: Record<string, unknown>,
): body is Record<string, unknown> & { twoFactorAuthenticationTicket: string } {
  return typeof body?.twoFactorAuthenticationTicket === "string";
}

function readUbisoftSession(
  attempt: UbisoftSessionAttempt,
  rejectionMessage: string,
): UbisoftSession {
  const session = attempt.body as unknown as UbisoftSession;
  if (attempt.status !== 200 || typeof session?.ticket !== "string") {
    // Ubisoft's auth service returns a JSON `message` ("Invalid
    // credentials", "The Ubi-AppId header is invalid", ...) that is far
    // more useful than a bare status; pass it through. A 403 whose body is
    // not the auth-service JSON is the DataDome bot wall, not a credential
    // verdict, so name it as such rather than implying a wrong password.
    const ubiMessage =
      typeof attempt.body?.message === "string" ? attempt.body.message : "";
    if (attempt.status === 401)
      throw createError({
        statusCode: 401,
        statusMessage: ubiMessage || rejectionMessage,
      });
    const botWall =
      attempt.status === 403 &&
      (attempt.body.message === undefined ||
        attempt.body.environment === undefined);
    throw createError({
      statusCode: attempt.status,
      statusMessage: `Ubisoft authentication failed (${attempt.status})${
        botWall
          ? ": blocked by Ubisoft's bot protection"
          : ubiMessage
            ? `: ${ubiMessage}`
            : ""
      }`,
    });
  }
  if (typeof session.userId !== "string" || !session.userId)
    throw createError({
      statusCode: 502,
      statusMessage: "Ubisoft returned a session without a user id",
    });
  return session;
}

/**
 * Refresh a session by replaying a valid ticket. Ubisoft rotates sessions by
 * presenting the previous ticket; a new session/ticket pair is returned.
 */
export async function refreshUbisoftSession(
  ticket: string,
): Promise<UbisoftSession> {
  const response = await ubiFetch(
    UBISOFT_SESSIONS_URL,
    {
      method: "POST",
      headers: {
        ...sessionAuthHeaders(),
        // Session tickets travel as `Ubi_v1 t=<ticket>`; never log them.
        Authorization: `Ubi_v1 t=${ticket}`,
      },
    },
    "Failed to refresh Ubisoft Connect session",
  );
  return (await response.json()) as UbisoftSession;
}

/**
 * List titles owned by the account (`discover`). Only owned spaces may be
 * ingested; ownership is the adapter's authorization boundary.
 */
export async function getUbisoftOwnedTitles(
  ticket: string,
): Promise<UbisoftOwnedTitle[]> {
  // The GraphQL gateway validates the ticket, the launcher app id, and a
  // per-call Ubi-SessionId (a client-generated UUID - Ubisoft assigns no
  // meaning to its value; the header's presence is what is checked).
  const response = await ubiFetch(
    UBISOFT_GRAPHQL_URL,
    {
      method: "POST",
      headers: {
        ...ubiHeaders(ticket, UBISOFT_SESSION_APP_ID),
        "Ubi-SessionId": randomUUID(),
      },
      body: JSON.stringify({ query: UBISOFT_OWNED_GAMES_QUERY }),
    },
    "Failed to fetch Ubisoft owned titles",
  );
  const payload = (await response.json().catch(() => null)) as {
    data?: { viewer?: { games?: { nodes?: UbisoftOwnedTitle[] } } };
    errors?: { message?: string; extensions?: { code?: string } }[];
  } | null;
  const failure = payload?.errors?.[0];
  if (failure)
    throw createError({
      statusCode: 502,
      statusMessage: `Ubisoft's library query failed: ${failure.message ?? failure.extensions?.code ?? "unknown error"}`,
    });
  return payload?.data?.viewer?.games?.nodes ?? [];
}
