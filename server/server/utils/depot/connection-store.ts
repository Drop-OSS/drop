import prisma from "~/server/internal/db/database";
import { StoreProvider, SyncStatus } from "~/prisma/client/enums";
import type {
  ConnectionRow,
  ConnectionStore,
  DepotProvider,
} from "./connections";
import { openSecret, sealSecret } from "./credential-crypto";

const TO_ENUM: Record<DepotProvider, StoreProvider> = {
  gog: StoreProvider.GOG,
  epic: StoreProvider.EPIC,
  ubisoft: StoreProvider.UBISOFT,
  ea: StoreProvider.EA,
};

const FROM_ENUM: Partial<Record<StoreProvider, DepotProvider>> = {
  [StoreProvider.GOG]: "gog",
  [StoreProvider.EPIC]: "epic",
  [StoreProvider.UBISOFT]: "ubisoft",
  [StoreProvider.EA]: "ea",
};

type StoreRow = {
  id: string;
  provider: StoreProvider;
  accountId: string;
  username: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  status?: SyncStatus;
  error?: string | null;
  updatedAt: Date;
};

function toRow(row: StoreRow): ConnectionRow {
  return {
    id: row.id,
    // STEAM rows have no depot provider yet; the lowercase fallback keeps
    // future enum additions from breaking the read path.
    provider: (FROM_ENUM[row.provider] ??
      String(row.provider).toLowerCase()) as ConnectionRow["provider"],
    accountId: row.accountId,
    username: row.username,
    // Credentials are sealed at rest; legacy plaintext rows read through
    // and get re-sealed by the next token write.
    accessToken: openSecret(row.accessToken),
    refreshToken: openSecret(row.refreshToken),
    expiresAt: row.expiresAt,
    status: row.status ?? null,
    error: row.error ?? null,
    updatedAt: row.updatedAt,
  };
}

export const prismaConnectionStore: ConnectionStore = {
  async upsert(row) {
    // A fresh connect (or reconnect) proves the credentials again, so the
    // re-auth flag written by a failed refresh is cleared here.
    const saved = await prisma.storeConnection.upsert({
      where: {
        provider_accountId: {
          provider: TO_ENUM[row.provider],
          accountId: row.accountId,
        },
      },
      update: {
        username: row.username ?? null,
        accessToken: sealSecret(row.accessToken ?? null),
        refreshToken: sealSecret(row.refreshToken ?? null),
        expiresAt: row.expiresAt ?? null,
        status: SyncStatus.IDLE,
        error: null,
      },
      create: {
        provider: TO_ENUM[row.provider],
        accountId: row.accountId,
        username: row.username ?? null,
        accessToken: sealSecret(row.accessToken ?? null),
        refreshToken: sealSecret(row.refreshToken ?? null),
        expiresAt: row.expiresAt ?? null,
      },
    });
    return toRow(saved);
  },
  async newest(provider) {
    const row = await prisma.storeConnection.findFirst({
      where: { provider: TO_ENUM[provider] },
      orderBy: { updatedAt: "desc" },
    });
    return row ? toRow(row) : null;
  },
  async list() {
    const rows = await prisma.storeConnection.findMany({
      orderBy: [{ provider: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map(toRow);
  },
  async remove(id) {
    const deleted = await prisma.storeConnection.deleteMany({ where: { id } });
    return deleted.count > 0;
  },
  async updateTokens(id, patch) {
    // patch.refreshToken is required (never implicit null): GOG and Ubisoft
    // rotate refresh tokens on use, and dropping the new one would brick the
    // connection. A successful renewal also clears a stale re-auth flag.
    await prisma.storeConnection.updateMany({
      where: { id },
      data: {
        accessToken: sealSecret(patch.accessToken),
        refreshToken: sealSecret(patch.refreshToken),
        expiresAt: patch.expiresAt ?? null,
        status: SyncStatus.IDLE,
        error: null,
      },
    });
  },
  async markNeedsReauth(id, reason) {
    // The refresh token was rejected outright (revoked, expired, password
    // changed). Nothing the server can retry will fix that; the admin must
    // sign in again, and resolveDepotToken stops knocking on the provider
    // until then.
    await prisma.storeConnection.updateMany({
      where: { id },
      data: { status: SyncStatus.ERROR, error: reason.slice(0, 300) },
    });
  },
};

/** One library listing to cache in `StoreManifest`. */
export type StoreManifestListing = {
  externalGameId: string;
  title: string;
  slug?: string;
  image?: string;
  version?: string;
  payload?: unknown;
};

/**
 * Cache a provider's library listing rows for a connection. Refreshes the
 * store metadata but never touches `imported`/`localContentId`, so what the
 * acquisition pipeline recorded survives a library refresh.
 */
export async function recordStoreManifests(
  connectionId: string,
  listings: StoreManifestListing[],
): Promise<void> {
  for (const listing of listings) {
    if (!listing.externalGameId) continue;
    const metadata = {
      title: listing.title,
      slug: listing.slug ?? null,
      image: listing.image ?? null,
      version: listing.version ?? null,
      payload: (listing.payload ?? undefined) as never,
    };
    await prisma.storeManifest.upsert({
      where: {
        connectionId_externalGameId: {
          connectionId,
          externalGameId: listing.externalGameId,
        },
      },
      update: metadata,
      create: {
        connectionId,
        externalGameId: listing.externalGameId,
        ...metadata,
      },
    });
  }
}

/**
 * Record a published depot release against a cached listing: the digest
 * becomes `localContentId`, creating the row when the library was never
 * browsed after connecting.
 */
export async function markStoreManifestImported(
  connectionId: string,
  externalGameId: string,
  localContentId: string,
  title?: string,
): Promise<void> {
  await prisma.storeManifest.upsert({
    where: {
      connectionId_externalGameId: { connectionId, externalGameId },
    },
    update: { imported: true, localContentId, ...(title ? { title } : {}) },
    create: {
      connectionId,
      externalGameId,
      title: title ?? externalGameId,
      imported: true,
      localContentId,
    },
  });
}
