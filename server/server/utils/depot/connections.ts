import { createError } from "h3";
import { refreshGogToken } from "../gog";
import { exchangeEpicAuthCode, refreshEpicToken } from "../epic/client";
import { fetchEaPid, refreshEaToken } from "../ea/client";

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
      refreshToken?: string | null;
      expiresAt?: Date | null;
    },
  ): Promise<void>;
}

export type SaveConnectionInput =
  | {
      provider: "gog";
      accessToken: string;
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
  | { provider: "ubisoft"; ticket: string; userId: string; username?: string }
  | {
      provider: "ea";
      accessToken?: string;
      refreshToken?: string;
      accountId?: string;
      username?: string;
    };

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
 * Store (or replace) the credentials for one store account. Epic and EA
 * upgrade a code/refresh-token to a full token set on connect; GOG derives
 * the account id from the JWT claims; EA derives the pid via the identity
 * profile endpoint.
 */
export async function saveConnection(
  store: ConnectionStore,
  input: SaveConnectionInput,
): Promise<ConnectionRow> {
  switch (input.provider) {
    case "gog": {
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
      const ticket = input.ticket?.trim();
      const userId = input.userId?.trim();
      if (!ticket || !userId)
        throw createError({
          statusCode: 400,
          statusMessage: "A Ubisoft session ticket and userId are required",
        });
      return store.upsert({
        provider: "ubisoft",
        accountId: userId,
        username: input.username ?? null,
        accessToken: ticket,
        refreshToken: null,
        expiresAt: null,
      });
    }
    case "ea": {
      let accessToken = input.accessToken?.trim() || null;
      let refreshToken = input.refreshToken?.trim() || null;
      let expiresAt: Date | null = null;
      if (!accessToken && refreshToken) {
        const tokens = await refreshEaToken(
          refreshToken,
          process.env.EA_OAUTH_CLIENT_ID ?? "",
          process.env.EA_OAUTH_CLIENT_SECRET ?? "",
        );
        accessToken = tokens.access_token;
        refreshToken = tokens.refresh_token ?? refreshToken;
        expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      }
      if (!accessToken)
        throw createError({
          statusCode: 400,
          statusMessage: "Provide an EA access token or refresh token",
        });
      let accountId = input.accountId?.trim();
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
): Promise<{ token: string; accountId?: string }> {
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
    const refreshed = await tryRefresh(store, row);
    if (!refreshed)
      throw createError({
        // Distinct from the 401 "no connection": the caller must re-authenticate
        // with the store, and a caller token can still satisfy the request.
        statusCode: 410,
        statusMessage: `The stored ${provider.toUpperCase()} connection has expired - reconnect the account`,
      });
    return refreshed;
  }
  return { token: row.accessToken, accountId: row.accountId };
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
    if (
      row.provider === "ea" &&
      row.refreshToken &&
      process.env.EA_OAUTH_CLIENT_ID &&
      process.env.EA_OAUTH_CLIENT_SECRET
    ) {
      const tokens = await refreshEaToken(
        row.refreshToken,
        process.env.EA_OAUTH_CLIENT_ID,
        process.env.EA_OAUTH_CLIENT_SECRET,
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
  } catch {
    return null;
  }
}
