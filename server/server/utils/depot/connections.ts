import { createError } from "h3";
import { exchangeGogAuthorizationCode, refreshGogToken } from "../gog";
import { exchangeEpicAuthCode, refreshEpicToken } from "../epic/client";
import {
  EA_HELP_SESSION_PREFIX,
  eaAccountIdFromCookies,
  exchangeEaLoginCode,
  exchangeEaSessionCookie,
  fetchEaPid,
  getEaHelpLibrary,
  normalizeEaCookieHeader,
  refreshEaToken,
} from "../ea/client";
import {
  completeUbisoftTwoFactor,
  createUbisoftSession,
  loginUbisoftWithRememberTicket,
  type UbisoftSession,
} from "../ubisoft/client";

/** Providers this fork's depot discovery understands. */
export type DepotProvider = "gog" | "epic" | "ubisoft" | "ea";

export const DEPOT_PROVIDERS: DepotProvider[] = [
  "gog",
  "epic",
  "ubisoft",
  "ea",
];

export type ConnectionRow = {
  id: string;
  provider: DepotProvider;
  accountId: string;
  username?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  /** "ERROR" marks a connection whose stored credential was rejected by the
   * provider and needs the admin to sign in again. */
  status?: string | null;
  error?: string | null;
  updatedAt?: Date | null;
};

/** Row shape the endpoints send back: everything except the credentials. */
export function maskConnection(row: ConnectionRow) {
  return {
    id: row.id,
    provider: row.provider,
    accountId: row.accountId,
    username: row.username ?? null,
    expiresAt: row.expiresAt ?? null,
    hasRefreshToken: Boolean(row.refreshToken),
    status: row.status ?? null,
    error: row.error ?? null,
    needsReauth: row.status === "ERROR",
    updatedAt: row.updatedAt ?? null,
  };
}

/**
 * Persistence seam for StoreConnection rows. The production implementation
 * lives in ./connection-store (prisma); keeping it an interface lets the
 * credential logic run under plain node tests.
 */
export interface ConnectionStore {
  upsert(row: Omit<ConnectionRow, "id">): Promise<ConnectionRow>;
  newest(provider: DepotProvider): Promise<ConnectionRow | null>;
  list(): Promise<ConnectionRow[]>;
  remove(id: string): Promise<boolean>;
  updateTokens(
    id: string,
    patch: {
      accessToken: string;
      /** Required: providers rotate refresh tokens on use, so callers must
       * state the value explicitly (pass the old one when unchanged). */
      refreshToken: string | null;
      expiresAt?: Date | null;
    },
  ): Promise<void>;
  /** Flag a connection whose stored credential the provider rejected: the
   * admin UI shows "needs re-auth" and no further refreshes are attempted. */
  markNeedsReauth(id: string, reason: string): Promise<void>;
}

export type SaveConnectionInput =
  | {
      provider: "gog";
      code?: string;
      accessToken?: string;
      refreshToken?: string;
      accountId?: string;
      username?: string;
    }
  | {
      provider: "epic";
      accountId?: string;
      code?: string;
      refreshToken?: string;
      accessToken?: string;
      username?: string;
    }
  | {
      provider: "ubisoft";
      email?: string;
      password?: string;
      code?: string;
      twoFactorTicket?: string;
      rememberTicket?: string;
      ticket?: string;
      userId?: string;
      username?: string;
    }
  | {
      provider: "ea";
      code?: string;
      sessionCookie?: string;
      browserCookies?: string;
      accessToken?: string;
      refreshToken?: string;
      accountId?: string;
      username?: string;
    };

/** Stored in refreshToken to mark an EA connection that renews by
 * re-exchanging the pasted ea.com session cookie, not by OAuth. */
export const EA_SESSION_COOKIE_PREFIX = "sid:";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * When a Ubisoft session ticket dies. Ubisoft states an absolute expiration;
 * without one, assume the short web-session lifetime and renew early rather
 * than letting discovery hit a dead ticket.
 */
function ubisoftSessionExpiry(session: UbisoftSession): Date {
  const parsed = session.expiration ? new Date(session.expiration) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed
    : new Date(Date.now() + 6 * 60 * 60 * 1000);
}

/**
 * Store (or replace) the credentials for one store account. Epic and EA
 * upgrade a code/refresh-token to a full token set on connect; GOG derives
 * the account id from the JWT claims; EA derives the pid via the identity
 * profile endpoint.
 */
/**
 * Ubisoft answered the password login by demanding a two-factor code.
 * Returned (not thrown) so the challenge survives to the browser: h3/nitro
 * may strip `error.data` from responses in production, and the UI cannot
 * complete 2FA without the ticket.
 */
export type UbisoftTwoFactorChallenge = {
  requiresTwoFactor: true;
  twoFactorTicket: string;
  method: string;
};

export type SaveConnectionResult = ConnectionRow | UbisoftTwoFactorChallenge;

export function isUbisoftTwoFactorChallenge(
  result: SaveConnectionResult,
): result is UbisoftTwoFactorChallenge {
  return "requiresTwoFactor" in result;
}

export async function saveConnection(
  store: ConnectionStore,
  input: SaveConnectionInput,
): Promise<SaveConnectionResult> {
  switch (input.provider) {
    case "gog": {
      if (input.code?.trim()) {
        // Browser sign-in under the launcher client: GOG returns the fresh
        // token set including the account id, plus a refresh token.
        const tokens = await exchangeGogAuthorizationCode(input.code);
        const accountId = tokens.user_id?.trim() || input.accountId?.trim();
        if (!accountId)
          throw createError({
            statusCode: 502,
            statusMessage: "GOG did not return an account id with the token",
          });
        return store.upsert({
          provider: "gog",
          accountId,
          username: input.username ?? null,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        });
      }
      const accessToken = input.accessToken?.trim();
      if (!accessToken)
        throw createError({
          statusCode: 400,
          statusMessage: "A GOG access token is required",
        });
      // Modern storefront tokens are JWTs carrying the user id; the classic
      // Galaxy/launcher tokens this fork's API calls use are opaque, so the
      // account id must come from the caller for those.
      const claims = decodeJwtPayload(accessToken);
      const accountId =
        input.accountId?.trim() ||
        (claims
          ? (str(claims.user) ?? str(claims.user_id) ?? str(claims.sub))
          : undefined);
      if (!accountId)
        throw createError({
          statusCode: 400,
          statusMessage:
            "This GOG token is not a JWT; supply the account id (gog.com/userData.json shows it as userId)",
        });
      const expires =
        claims && typeof claims.exp === "number"
          ? new Date(claims.exp * 1000)
          : null;
      return store.upsert({
        provider: "gog",
        accountId,
        username: input.username ?? null,
        accessToken,
        refreshToken: input.refreshToken?.trim() || null,
        expiresAt: expires,
      });
    }
    case "epic": {
      let accountId = input.accountId?.trim() || "";
      let accessToken = input.accessToken?.trim() || null;
      let refreshToken = input.refreshToken?.trim() || null;
      let expiresAt: Date | null = null;
      if (input.code?.trim() || refreshToken) {
        const tokens = input.code?.trim()
          ? await exchangeEpicAuthCode(input.code.trim())
          : await refreshEpicToken(refreshToken as string);
        accessToken = tokens.access_token;
        refreshToken = tokens.refresh_token ?? refreshToken;
        expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        // Epic returns the account id with every token set - the same one
        // Heroic reads, so pasting a code or refresh token is enough.
        if (!accountId) accountId = tokens.account_id?.trim() || "";
      }
      if (!accessToken)
        throw createError({
          statusCode: 400,
          statusMessage:
            "Provide an Epic code, refresh token, or access token to connect",
        });
      if (!accountId)
        throw createError({
          statusCode: 400,
          statusMessage:
            "Could not derive the Epic account id; supply accountId when pasting a bare access token",
        });
      return store.upsert({
        provider: "epic",
        accountId,
        username: input.username ?? null,
        accessToken,
        refreshToken,
        expiresAt,
      });
    }
    case "ubisoft": {
      const email = input.email?.trim();
      const code = input.code?.trim();
      const twoFactorTicket = input.twoFactorTicket?.trim();
      const rememberTicket = input.rememberTicket?.trim();
      let session: UbisoftSession | null = null;
      if (code && twoFactorTicket) {
        session = await completeUbisoftTwoFactor(code, twoFactorTicket);
      } else if (email && input.password) {
        const result = await createUbisoftSession(email, input.password);
        if ("twoFactorRequired" in result)
          return {
            requiresTwoFactor: true,
            twoFactorTicket: result.twoFactorTicket,
            method: result.method,
          };
        session = result;
      } else if (rememberTicket) {
        session = await loginUbisoftWithRememberTicket(rememberTicket);
      } else {
        const ticket = input.ticket?.trim();
        const userId = input.userId?.trim();
        if (ticket && userId) {
          // Legacy paste path: an externally obtained ticket, stored until it
          // dies - there is no way to renew it without the login flows above.
          return store.upsert({
            provider: "ubisoft",
            accountId: userId,
            username: input.username ?? null,
            accessToken: ticket,
            refreshToken: null,
            expiresAt: null,
          });
        }
        throw createError({
          statusCode: 400,
          statusMessage:
            "Provide Ubisoft email and password, a 2FA code with its challenge, a remember-me ticket, or a ticket and userId pair",
        });
      }
      return store.upsert({
        provider: "ubisoft",
        accountId: session.userId,
        username:
          input.username ?? session.profiles?.[0]?.nameOnPlatform ?? null,
        accessToken: session.ticket,
        refreshToken: session.rememberMeTicket ?? null,
        expiresAt: ubisoftSessionExpiry(session),
      });
    }
    case "ea": {
      let accessToken = input.accessToken?.trim() || null;
      let refreshToken = input.refreshToken?.trim() || null;
      let expiresAt: Date | null = null;
      let accountId = input.accountId?.trim();
      if (input.browserCookies?.trim()) {
        // Verified path: a signed-in help.ea.com browser session pasted as
        // its Cookie header. No OAuth client exists for EA, and the Help
        // player-shell API lists this account's owned titles with nothing
        // but these cookies. Saved only after EA accepts them once.
        const cookie = normalizeEaCookieHeader(input.browserCookies);
        await getEaHelpLibrary(`${EA_HELP_SESSION_PREFIX}${cookie}`);
        accessToken = `${EA_HELP_SESSION_PREFIX}${cookie}`;
        refreshToken = accessToken;
        accountId = accountId || eaAccountIdFromCookies(cookie);
      } else if (input.sessionCookie?.trim()) {
        // Web-session sign-in: mint a JWT from the pasted ea.com cookie now,
        // keep the cookie itself as the credential that mints the next one.
        const session = await exchangeEaSessionCookie(input.sessionCookie);
        accessToken = session.jwt;
        refreshToken = `${EA_SESSION_COOKIE_PREFIX}${input.sessionCookie.trim()}`;
        expiresAt = session.expiresAt;
        accountId = accountId || session.userId || undefined;
      } else if (input.code?.trim()) {
        // Browser sign-in with the deployment's configured EA OAuth client.
        const tokens = await exchangeEaLoginCode(input.code);
        accessToken = tokens.access_token;
        refreshToken = tokens.refresh_token ?? refreshToken;
        expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      } else if (!accessToken && refreshToken) {
        const clientId = process.env.EA_OAUTH_CLIENT_ID;
        const clientSecret = process.env.EA_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret)
          throw createError({
            statusCode: 400,
            statusMessage:
              "Refreshing an EA token requires EA_OAUTH_CLIENT_ID/EA_OAUTH_CLIENT_SECRET on the server; paste a fresh access token instead",
          });
        const tokens = await refreshEaToken(
          refreshToken,
          clientId,
          clientSecret,
        );
        accessToken = tokens.access_token;
        refreshToken = tokens.refresh_token ?? refreshToken;
        expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      }
      if (!accessToken)
        throw createError({
          statusCode: 400,
          statusMessage:
            "Provide an EA sign-in code, access token, or refresh token",
        });
      if (!accountId) {
        try {
          accountId = await fetchEaPid(accessToken);
        } catch {
          throw createError({
            statusCode: 400,
            statusMessage:
              "Could not resolve the EA account pid from the token; supply accountId explicitly",
          });
        }
      }
      return store.upsert({
        provider: "ea",
        accountId,
        username: input.username ?? null,
        accessToken,
        refreshToken,
        expiresAt,
      });
    }
  }
}

/**
 * Pick the credential a discovery call should use: an explicit caller token
 * always wins, otherwise the newest stored connection for the provider,
 * refreshed on the fly when it has expired and a refresh path exists.
 */
export async function resolveDepotToken(
  store: ConnectionStore,
  provider: DepotProvider,
  callerToken?: string,
): Promise<{ token: string; accountId?: string; connectionId?: string }> {
  if (callerToken) return { token: callerToken };
  const row = await store.newest(provider);
  if (!row?.accessToken)
    throw createError({
      statusCode: 401,
      statusMessage: `No stored ${provider.toUpperCase()} connection - connect the account or pass a token`,
    });
  const expiringSoon =
    row.expiresAt !== null &&
    row.expiresAt !== undefined &&
    row.expiresAt.getTime() < Date.now() + 60_000;
  if (expiringSoon) {
    if (row.status === "ERROR")
      throw createError({
        // The last refresh proved the stored credential dead; retrying it
        // only hammers the provider. Re-authentication is the only way out.
        statusCode: 410,
        statusMessage: `The stored ${provider.toUpperCase()} connection needs re-authentication${
          row.error ? `: ${row.error}` : ""
        }`,
      });
    const refreshed = await refreshOnce(store, row);
    if (!refreshed)
      throw createError({
        // Distinct from the 401 "no connection": the caller must re-authenticate
        // with the store, and a caller token can still satisfy the request.
        statusCode: 410,
        statusMessage: `The stored ${provider.toUpperCase()} connection has expired - reconnect the account`,
      });
    return { ...refreshed, connectionId: row.id };
  }
  return {
    token: row.accessToken,
    accountId: row.accountId,
    connectionId: row.id,
  };
}

/**
 * In-flight refreshes by connection id. GOG and Ubisoft rotate the refresh
 * token on every use, so two concurrent callers renewing with the same old
 * token would make the second one (or the loser of the write race) dead on
 * arrival. Concurrent resolutions coalesce into one provider call.
 */
const refreshInFlight = new Map<
  string,
  Promise<{ token: string; accountId?: string } | null>
>();

function refreshOnce(
  store: ConnectionStore,
  row: ConnectionRow,
): Promise<{ token: string; accountId?: string } | null> {
  let flight = refreshInFlight.get(row.id);
  if (!flight) {
    flight = tryRefresh(store, row).finally(() => {
      refreshInFlight.delete(row.id);
    });
    refreshInFlight.set(row.id, flight);
  }
  return flight;
}

/**
 * A 4xx from the token endpoint (other than rate limiting and transient
 * 408/425) means the provider looked at the credential and refused it -
 * revoked, rotated away, or account-changed. Retrying can never succeed;
 * only a network failure (no statusCode) or a 5xx can.
 */
function isDeadTokenRejection(error: unknown): boolean {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 425 &&
    status !== 429
  );
}

/** Provider failure text fit for the admin UI and logs: never includes
 * secrets we sent; keep the message, drop control characters. */
function rejectionReason(error: unknown): string {
  const message =
    (error as { statusMessage?: string; message?: string } | null)
      ?.statusMessage ??
    (error as { message?: string } | null)?.message ??
    "";
  const clean = Array.from(message, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f ? " " : ch;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return (
    (clean || "the store rejected the saved credential").slice(0, 300) ||
    "the store rejected the saved credential"
  );
}

async function tryRefresh(
  store: ConnectionStore,
  row: ConnectionRow,
): Promise<{ token: string; accountId?: string } | null> {
  try {
    if (row.provider === "gog" && row.refreshToken) {
      const tokens = await refreshGogToken(row.refreshToken);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await store.updateTokens(row.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? row.refreshToken,
        expiresAt,
      });
      return { token: tokens.access_token, accountId: row.accountId };
    }
    if (row.provider === "ubisoft" && row.refreshToken) {
      // The remember-me ticket re-opens a session without the password;
      // Ubisoft rotates it along with the new ticket.
      const session = await loginUbisoftWithRememberTicket(row.refreshToken);
      await store.updateTokens(row.id, {
        accessToken: session.ticket,
        refreshToken: session.rememberMeTicket ?? row.refreshToken,
        expiresAt: ubisoftSessionExpiry(session),
      });
      return { token: session.ticket, accountId: row.accountId };
    }
    if (row.provider === "epic" && row.refreshToken) {
      const tokens = await refreshEpicToken(row.refreshToken);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await store.updateTokens(row.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? row.refreshToken,
        expiresAt,
      });
      return { token: tokens.access_token, accountId: row.accountId };
    }
    if (row.provider === "ea" && row.refreshToken) {
      if (row.refreshToken.startsWith(EA_HELP_SESSION_PREFIX)) {
        // Cookie-backed connection: validate against live EA; a killed
        // session fails below and callers surface "sign in again" (410).
        await getEaHelpLibrary(row.refreshToken);
        return {
          token: row.accessToken ?? row.refreshToken,
          accountId: row.accountId,
        };
      }
      if (row.refreshToken.startsWith(EA_SESSION_COOKIE_PREFIX)) {
        // Cookie-backed connection: re-exchange the ea.com sid for a fresh
        // JWT. When EA kills the cookie the exchange 401s, the catch below
        // returns null, and callers surface "sign in again" (410).
        const session = await exchangeEaSessionCookie(
          row.refreshToken.slice(EA_SESSION_COOKIE_PREFIX.length),
        );
        await store.updateTokens(row.id, {
          accessToken: session.jwt,
          refreshToken: row.refreshToken,
          expiresAt: session.expiresAt,
        });
        return { token: session.jwt, accountId: row.accountId };
      }
      // Renewal needs the deployment's confidential EA client; without it
      // the connection cannot self-renew and reports "reconnect" (410).
      const clientId = process.env.EA_OAUTH_CLIENT_ID;
      const clientSecret = process.env.EA_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      const tokens = await refreshEaToken(
        row.refreshToken,
        clientId,
        clientSecret,
      );
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await store.updateTokens(row.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? row.refreshToken,
        expiresAt,
      });
      return { token: tokens.access_token, accountId: row.accountId };
    }
    return null;
  } catch (error) {
    // A provider refusal (4xx) is final: flag the row so the admin sees
    // "needs re-auth" and resolveDepotToken stops calling the provider with
    // the dead token. Network faults stay unflagged so the next call can
    // try again. Tokens never appear in the recorded reason.
    if (isDeadTokenRejection(error)) {
      try {
        await store.markNeedsReauth(row.id, rejectionReason(error));
      } catch {
        // Flagging must not change the caller's outcome: still 410.
      }
    }
    return null;
  }
}
