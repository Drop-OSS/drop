import prisma from "~/server/internal/db/database";
import { StoreProvider } from "~/prisma/client/enums";
import type {
  ConnectionRow,
  ConnectionStore,
  DepotProvider,
} from "./connections";

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
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
    updatedAt: row.updatedAt,
  };
}

export const prismaConnectionStore: ConnectionStore = {
  async upsert(row) {
    const saved = await prisma.storeConnection.upsert({
      where: {
        provider_accountId: {
          provider: TO_ENUM[row.provider],
          accountId: row.accountId,
        },
      },
      update: {
        username: row.username ?? null,
        accessToken: row.accessToken,
        refreshToken: row.refreshToken,
        expiresAt: row.expiresAt ?? null,
        error: null,
      },
      create: {
        provider: TO_ENUM[row.provider],
        accountId: row.accountId,
        username: row.username ?? null,
        accessToken: row.accessToken,
        refreshToken: row.refreshToken,
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
    await prisma.storeConnection.updateMany({
      where: { id },
      data: {
        accessToken: patch.accessToken,
        refreshToken: patch.refreshToken ?? null,
        expiresAt: patch.expiresAt ?? null,
      },
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
