import Stream from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { createError } from "h3";
import { canonicalize } from "json-canonicalize";
import type { Prisma } from "~/prisma/client/client";
import { SaveVersionKind } from "~/prisma/client/enums";
import type {
  SaveManifestModel,
  SaveSlotModel,
  SaveVersionModel,
} from "~/prisma/client/models";
import { applicationSettings } from "../config/application-configuration";
import prisma from "../db/database";
import { logger } from "../logging";
import objectHandler from "../objects";
import { decideSync, type SyncDecision } from "./conflict";
import { isUniqueViolation, SaveConflictError } from "./errors";
import { isSha256 } from "./hash";
import { selectVersionsToPrune } from "./retention";
import { formatBytes } from "../utils/files";

/** Raised while streaming when a save exceeds `saveSlotSizeLimit`. */
class SaveSizeLimitError extends Error {
  constructor() {
    super("save exceeds saveSlotSizeLimit");
    this.name = "SaveSizeLimitError";
  }
}

export type SaveVersionDto = {
  id: string;
  gameId: string;
  userId: string;
  profileId: string;
  slotIndex: number;
  objectId: string;
  archiveSha256: string;
  contentHash: string;
  sizeBytes: number | null;
  fileCount: number | null;
  parentVersionId: string | null;
  restoredFromVersionId: string | null;
  createdByClientId: string | null;
  clientMutationId: string | null;
  kind: SaveVersionKind;
  archiveFormat: string;
  manifestHash: string | null;
  metadata: Prisma.JsonValue;
  pinned: boolean;
  createdAt: Date;
};

export type SaveSlotDto = {
  gameId: string;
  userId: string;
  profileId: string;
  index: number;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
  playtime: number;
  lastUsedClientId: string | null;
  head: SaveVersionDto | null;
  versionCount: number;
};

export type CreateVersionInput = {
  gameId: string;
  userId: string;
  profileId: string;
  index: number;
  clientId: string;
  clientName?: string;
  clientPlatform?: string;
  stream: IncomingMessage;
  /** The version the client last synced; `null` for a first upload. */
  baseVersionId: string | null;
  contentHash: string | null;
  archiveSha256: string | null;
  declaredSize: number | null;
  fileCount: number | null;
  manifestHash: string | null;
  clientMutationId: string | null;
  kind: SaveVersionKind;
  metadata?: Record<string, unknown>;
};

type SlotWithCount = SaveSlotModel & { _count: { versions: number } };

export function toSaveVersionDto(version: SaveVersionModel): SaveVersionDto {
  return {
    id: version.id,
    gameId: version.gameId,
    userId: version.userId,
    profileId: version.profileId,
    slotIndex: version.slotIndex,
    objectId: version.objectId,
    archiveSha256: version.archiveSha256,
    contentHash: version.contentHash,
    sizeBytes: version.sizeBytes,
    fileCount: version.fileCount,
    parentVersionId: version.parentVersionId,
    restoredFromVersionId: version.restoredFromVersionId,
    createdByClientId: version.createdByClientId,
    clientMutationId: version.clientMutationId,
    kind: version.kind,
    archiveFormat: version.archiveFormat,
    manifestHash: version.manifestHash,
    metadata: version.metadata,
    pinned: version.pinned,
    createdAt: version.createdAt,
  };
}

function toSaveSlotDto(
  slot: SlotWithCount,
  head: SaveVersionModel | null,
): SaveSlotDto {
  return {
    gameId: slot.gameId,
    userId: slot.userId,
    profileId: slot.profileId,
    index: slot.index,
    label: slot.label,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
    playtime: slot.playtime,
    lastUsedClientId: slot.lastUsedClientId,
    head: head ? toSaveVersionDto(head) : null,
    versionCount: slot._count.versions,
  };
}

class SaveManager {
  private async sizeLimitBytes(): Promise<number> {
    const limitMb = await applicationSettings.get("saveSlotSizeLimit");
    return Math.max(1, Math.floor(limitMb * 1024 * 1024));
  }

  /** `null` means unlimited (`saveUserStorageLimit` is MB, 0 = unlimited). */
  private async userStorageLimitBytes(): Promise<number | null> {
    const limitMb = await applicationSettings.get("saveUserStorageLimit");
    if (!(limitMb > 0)) return null;
    return Math.floor(limitMb * 1024 * 1024);
  }

  /** Everything the user's save history holds right now, in bytes. */
  async userStorageUsedBytes(userId: string): Promise<number> {
    const total = await prisma.saveVersion.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
    });
    return total._sum.sizeBytes ?? 0;
  }

  /**
   * The per-user quota is metered over the versions that are stored now, so
   * a push is refused before its bytes land rather than pruning its way in:
   * retention pruning runs after the new version exists, and history that is
   * about to be pruned is not free space an upload may spend.
   */
  private async assertUserStorageQuota(
    userId: string,
    incomingBytes: number | null,
  ): Promise<void> {
    if (incomingBytes === null) return;
    const limit = await this.userStorageLimitBytes();
    if (limit === null) return;
    const used = await this.userStorageUsedBytes(userId);
    if (used + incomingBytes <= limit) return;
    throw createError({
      statusCode: 400,
      statusMessage: `Save storage quota exceeded: ${formatBytes(used)} stored of ${formatBytes(limit)}, this upload needs ${formatBytes(incomingBytes)}`,
    });
  }

  private async historyLimit(): Promise<number> {
    return Math.max(1, await applicationSettings.get("saveSlotHistoryLimit"));
  }

  private async slotLimit(): Promise<number> {
    return Math.max(1, await applicationSettings.get("saveSlotCountLimit"));
  }

  private async requireSlot(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
  ): Promise<SlotWithCount> {
    const slot = await prisma.saveSlot.findUnique({
      where: { id: { userId, profileId, gameId, index } },
      include: { _count: { select: { versions: true } } },
    });
    if (!slot)
      throw createError({ statusCode: 404, statusMessage: "Save not found" });
    return slot;
  }

  private async requireVersion(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    versionId: string,
  ): Promise<SaveVersionModel> {
    const version = await prisma.saveVersion.findFirst({
      where: {
        id: versionId,
        gameId,
        userId,
        profileId,
        slotIndex: index,
      },
    });
    if (!version)
      throw createError({
        statusCode: 404,
        statusMessage: "Save version not found",
      });
    return version;
  }

  private async headsById(
    slots: SaveSlotModel[],
  ): Promise<Map<string, SaveVersionModel>> {
    const ids = slots
      .map((slot) => slot.headVersionId)
      .filter((id): id is string => typeof id === "string");
    if (ids.length === 0) return new Map();
    const heads = await prisma.saveVersion.findMany({
      where: { id: { in: ids } },
    });
    return new Map(heads.map((head) => [head.id, head]));
  }

  async listSlots(userId: string, profileId: string): Promise<SaveSlotDto[]> {
    const slots = await prisma.saveSlot.findMany({
      where: { userId, profileId },
      include: { _count: { select: { versions: true } } },
      orderBy: [{ gameId: "asc" }, { index: "asc" }],
    });
    const heads = await this.headsById(slots);
    return slots.map((slot) =>
      toSaveSlotDto(
        slot,
        slot.headVersionId ? (heads.get(slot.headVersionId) ?? null) : null,
      ),
    );
  }

  async listGameSlots(
    userId: string,
    profileId: string,
    gameId: string,
  ): Promise<SaveSlotDto[]> {
    const slots = await prisma.saveSlot.findMany({
      where: { userId, profileId, gameId },
      include: { _count: { select: { versions: true } } },
      orderBy: { index: "asc" },
    });
    const heads = await this.headsById(slots);
    return slots.map((slot) =>
      toSaveSlotDto(
        slot,
        slot.headVersionId ? (heads.get(slot.headVersionId) ?? null) : null,
      ),
    );
  }

  async getSlot(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
  ): Promise<SaveSlotDto> {
    const slot = await this.requireSlot(userId, profileId, gameId, index);
    const head = slot.headVersionId
      ? await prisma.saveVersion.findUnique({
          where: { id: slot.headVersionId },
        })
      : null;
    return toSaveSlotDto(slot, head);
  }

  /**
   * The one call a client makes before launching and again on exit: it answers
   * what to do, given what the device last synced and what it has locally now.
   * A slot that does not exist yet is simply an empty one, so a first backup
   * needs no setup round trip.
   */
  async syncState(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    options: { baseVersionId: string | null; localContentHash: string | null },
  ): Promise<{
    decision: SyncDecision;
    baseContentHash: string | null;
    head: SaveVersionDto | null;
  }> {
    if (
      options.localContentHash !== null &&
      !isSha256(options.localContentHash)
    )
      throw createError({
        statusCode: 400,
        statusMessage: "localContentHash must be a SHA-256 hex digest",
      });

    const slot = await prisma.saveSlot.findUnique({
      where: { id: { userId, profileId, gameId, index } },
      select: { headVersionId: true },
    });
    const headVersionId = slot?.headVersionId ?? null;
    const head = headVersionId
      ? await prisma.saveVersion.findUnique({
          where: { id: headVersionId },
        })
      : null;

    // The baseline is usually the head; only look further back when it is not,
    // and never past this user's own slot.
    const base =
      options.baseVersionId && options.baseVersionId !== headVersionId
        ? await prisma.saveVersion.findFirst({
            where: {
              id: options.baseVersionId,
              userId,
              profileId,
              gameId,
              slotIndex: index,
            },
          })
        : null;
    const baseContentHash =
      options.baseVersionId === null
        ? null
        : options.baseVersionId === headVersionId
          ? (head?.contentHash ?? null)
          : (base?.contentHash ?? null);

    const decision = decideSync({
      baseVersionId: options.baseVersionId,
      headVersionId,
      localContentHash: options.localContentHash,
      baseContentHash,
      headContentHash: head?.contentHash ?? null,
    });

    return {
      decision,
      baseContentHash,
      head: head ? toSaveVersionDto(head) : null,
    };
  }

  async createSlot(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    label: string | null,
    clientId: string,
  ): Promise<SaveSlotDto> {
    if (!Number.isSafeInteger(index) || index < 0)
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid slot index",
      });
    const cleanLabel = label?.trim().slice(0, 100) || null;

    const existing = await prisma.saveSlot.findUnique({
      where: { id: { userId, profileId, gameId, index } },
      select: { gameId: true },
    });
    if (existing)
      throw createError({
        statusCode: 409,
        statusMessage: "Save slot already exists",
      });

    const count = await prisma.saveSlot.count({
      where: { userId, profileId, gameId },
    });
    if (count >= (await this.slotLimit()))
      throw createError({
        statusCode: 400,
        statusMessage: "Out of save slots",
      });

    const slot = await prisma.saveSlot.create({
      data: {
        userId,
        profileId,
        gameId,
        index,
        label: cleanLabel,
        lastUsedClientId: clientId,
        historyObjectIds: [],
        historyChecksums: [],
      },
      include: { _count: { select: { versions: true } } },
    });
    return toSaveSlotDto(slot, null);
  }

  /**
   * Create a slot at the lowest free index, the pre-versioning behaviour the
   * desktop client still uses when it does not send an index.
   */
  async createNextSlot(
    userId: string,
    profileId: string,
    gameId: string,
    label: string | null,
    clientId: string,
  ): Promise<SaveSlotDto> {
    const slots = await prisma.saveSlot.findMany({
      where: { userId, profileId, gameId },
      select: { index: true },
      orderBy: { index: "asc" },
    });
    let index = 0;
    for (const slot of slots) {
      if (slot.index === index) index++;
    }
    return this.createSlot(userId, profileId, gameId, index, label, clientId);
  }

  private async ensureAutoSlot(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    clientId: string,
  ): Promise<void> {
    const existing = await prisma.saveSlot.findUnique({
      where: { id: { userId, profileId, gameId, index } },
      select: { gameId: true },
    });
    if (existing) return;
    if (index !== 0)
      throw createError({ statusCode: 404, statusMessage: "Save not found" });

    try {
      await this.createSlot(userId, profileId, gameId, 0, null, clientId);
    } catch (error) {
      // Another device created the auto slot between the lookup and create.
      const now = await prisma.saveSlot.findUnique({
        where: { id: { userId, profileId, gameId, index } },
        select: { gameId: true },
      });
      if (!now) throw error;
    }
  }

  async listVersions(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    options: { cursor?: string | null; limit?: number } = {},
  ): Promise<SaveVersionDto[]> {
    await this.requireSlot(userId, profileId, gameId, index);
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

    // Page by createdAt rather than by Prisma cursor: a version may be pruned
    // between pages, and a cursor pointing at a deleted row must not fail.
    let before: { createdAt: Date; id: string } | null = null;
    if (options.cursor) {
      const cursor = await prisma.saveVersion.findFirst({
        where: {
          id: options.cursor,
          userId,
          profileId,
          gameId,
          slotIndex: index,
        },
        select: { id: true, createdAt: true },
      });
      if (!cursor)
        throw createError({
          statusCode: 400,
          statusMessage: "Unknown version cursor",
        });
      before = cursor;
    }

    const versions = await prisma.saveVersion.findMany({
      where: {
        userId,
        profileId,
        gameId,
        slotIndex: index,
        ...(before
          ? {
              // (createdAt, id) < cursor, so versions written in the same
              // millisecond still paginate.
              OR: [
                { createdAt: { lt: before.createdAt } },
                { createdAt: before.createdAt, id: { lt: before.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return versions.map(toSaveVersionDto);
  }

  async getVersion(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    versionId: string,
  ): Promise<SaveVersionDto> {
    return toSaveVersionDto(
      await this.requireVersion(userId, profileId, gameId, index, versionId),
    );
  }

  async downloadVersion(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    versionId: string,
  ) {
    const version = await this.requireVersion(
      userId,
      profileId,
      gameId,
      index,
      versionId,
    );
    const object = await objectHandler.fetchWithPermissions(
      version.objectId,
      userId,
    );
    if (!object)
      throw createError({
        statusCode: 404,
        statusMessage: "Save object not found",
      });
    return { version, ...object };
  }

  private async garbageCollectObjects(objectIds: string[]): Promise<void> {
    for (const objectId of new Set(objectIds)) {
      const references = await prisma.saveVersion.count({
        where: { objectId },
      });
      if (references > 0) continue;
      try {
        await objectHandler.deleteAsSystem(objectId);
      } catch (error) {
        logger.warn({ objectId, error }, "Failed to delete pruned save object");
      }
    }
  }

  private async pruneVersions(
    tx: Prisma.TransactionClient,
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    headVersionId: string,
  ): Promise<string[]> {
    const candidates = await tx.saveVersion.findMany({
      where: { userId, profileId, gameId, slotIndex: index },
      select: {
        id: true,
        pinned: true,
        objectId: true,
        createdAt: true,
      },
    });
    const pruneIds = selectVersionsToPrune(
      candidates,
      await this.historyLimit(),
      headVersionId,
    );
    if (pruneIds.length === 0) return [];

    const pruned = candidates.filter((version) =>
      pruneIds.includes(version.id),
    );
    await tx.saveVersion.deleteMany({ where: { id: { in: pruneIds } } });
    return pruned.map((version) => version.objectId);
  }

  async createVersion(input: CreateVersionInput): Promise<SaveVersionDto> {
    await this.ensureAutoSlot(
      input.userId,
      input.profileId,
      input.gameId,
      input.index,
      input.clientId,
    );

    if (input.clientMutationId) {
      const existing = await prisma.saveVersion.findFirst({
        where: {
          userId: input.userId,
          profileId: input.profileId,
          gameId: input.gameId,
          slotIndex: input.index,
          clientMutationId: input.clientMutationId,
        },
      });
      if (existing) return toSaveVersionDto(existing);
    }

    if (
      input.contentHash !== null &&
      input.contentHash !== undefined &&
      !isSha256(input.contentHash)
    )
      throw createError({
        statusCode: 400,
        statusMessage: "contentHash must be a SHA-256 hex digest",
      });

    const limit = await this.sizeLimitBytes();
    if (input.declaredSize !== null && input.declaredSize > limit)
      throw createError({
        statusCode: 413,
        statusMessage: "Save exceeds saveSlotSizeLimit",
      });

    // Fail a declared-size overrun before a single byte is written; the real
    // check below still runs on the measured size, because a client may
    // declare nothing at all (the legacy push path).
    await this.assertUserStorageQuota(input.userId, input.declaredSize);

    const objectId = randomUUID();
    const writable = await objectHandler.createWithStream(
      objectId,
      {
        saveSlot: JSON.stringify({
          userId: input.userId,
          profileId: input.profileId,
          gameId: input.gameId,
          index: input.index,
        }),
        clientId: input.clientId,
      },
      [`${input.userId}:read`],
    );
    if (!writable)
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to create writing stream to storage backend.",
      });

    const hash = createHash("sha256");
    let totalBytes = 0;
    const measuringStream = new Stream.Transform({
      transform(chunk: Buffer, _encoding, callback) {
        totalBytes += chunk.length;
        if (totalBytes > limit) {
          callback(new SaveSizeLimitError());
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await Stream.promises.pipeline(input.stream, measuringStream, writable);
    } catch (error) {
      await objectHandler.deleteAsSystem(objectId);
      if (error instanceof SaveSizeLimitError)
        throw createError({
          statusCode: 413,
          statusMessage: "Save exceeds saveSlotSizeLimit",
        });
      throw error;
    }

    // The measured size is the truth the quota is metered on.
    try {
      await this.assertUserStorageQuota(input.userId, totalBytes);
    } catch (error) {
      await objectHandler.deleteAsSystem(objectId);
      throw error;
    }

    const archiveSha256 = hash.digest("hex");
    if (
      input.archiveSha256 &&
      input.archiveSha256.toLowerCase() !== archiveSha256
    ) {
      await objectHandler.deleteAsSystem(objectId);
      throw createError({
        statusCode: 400,
        statusMessage: "Archive checksum does not match the upload",
      });
    }

    const versionContentHash = input.contentHash ?? archiveSha256;
    if (!isSha256(versionContentHash)) {
      await objectHandler.deleteAsSystem(objectId);
      throw createError({
        statusCode: 400,
        statusMessage: "contentHash must be a SHA-256 hex digest",
      });
    }

    // Uploading bytes the slot already stores must not double the storage: the
    // version gets its own row (so history and the head move) on the same object.
    let storedObjectId: string = objectId;
    const twin = await prisma.saveVersion.findFirst({
      where: {
        userId: input.userId,
        profileId: input.profileId,
        gameId: input.gameId,
        slotIndex: input.index,
        archiveSha256,
      },
      select: { objectId: true },
    });
    if (twin && twin.objectId !== objectId) {
      await objectHandler.deleteAsSystem(objectId);
      storedObjectId = twin.objectId;
    }

    const versionId = randomUUID();
    const metadata: Prisma.InputJsonValue = {
      ...(input.metadata ?? {}),
      clientId: input.clientId,
      clientName: input.clientName ?? null,
      clientPlatform: input.clientPlatform ?? null,
    } as Prisma.InputJsonValue;

    let prunedObjectIds: string[] = [];
    let created: SaveVersionModel;
    try {
      created = await prisma.$transaction(async (tx) => {
        const updated = await tx.saveSlot.updateMany({
          where: {
            userId: input.userId,
            profileId: input.profileId,
            gameId: input.gameId,
            index: input.index,
            headVersionId: input.baseVersionId,
          },
          data: {
            headVersionId: versionId,
            lastUsedClientId: input.clientId,
            updatedAt: new Date(),
          },
        });
        if (updated.count !== 1) {
          const current = await tx.saveSlot.findUnique({
            where: {
              id: {
                userId: input.userId,
                profileId: input.profileId,
                gameId: input.gameId,
                index: input.index,
              },
            },
            select: { headVersionId: true },
          });
          throw new SaveConflictError(current?.headVersionId ?? null);
        }

        const version = await tx.saveVersion.create({
          data: {
            id: versionId,
            gameId: input.gameId,
            userId: input.userId,
            profileId: input.profileId,
            slotIndex: input.index,
            objectId: storedObjectId,
            archiveSha256,
            contentHash: versionContentHash,
            sizeBytes: totalBytes,
            fileCount: input.fileCount,
            parentVersionId: input.baseVersionId,
            createdByClientId: input.clientId,
            clientMutationId: input.clientMutationId,
            kind: input.kind,
            manifestHash: input.manifestHash,
            metadata,
          },
        });

        prunedObjectIds = await this.pruneVersions(
          tx,
          input.userId,
          input.profileId,
          input.gameId,
          input.index,
          versionId,
        );
        return version;
      });
    } catch (error) {
      if (storedObjectId === objectId)
        await objectHandler.deleteAsSystem(objectId);
      // Two uploads sharing an Idempotency-Key: the loser returns the winner's
      // version instead of a unique-violation.
      if (input.clientMutationId && isUniqueViolation(error)) {
        const existing = await prisma.saveVersion.findFirst({
          where: {
            userId: input.userId,
            profileId: input.profileId,
            gameId: input.gameId,
            slotIndex: input.index,
            clientMutationId: input.clientMutationId,
          },
        });
        if (existing) return toSaveVersionDto(existing);
      }
      throw error;
    }

    await this.garbageCollectObjects(prunedObjectIds);
    return toSaveVersionDto(created);
  }

  /**
   * Compatibility path for the pre-versioning push endpoint. It behaves like
   * the old API (last write wins) by using the current head as its baseline;
   * new clients use createVersion with an explicit If-Match.
   */
  async pushSave(
    gameId: string,
    userId: string,
    profileId: string,
    index: number,
    stream: IncomingMessage,
    clientId: string,
  ): Promise<void> {
    const slot = await this.requireSlot(userId, profileId, gameId, index);
    await this.createVersion({
      gameId,
      userId,
      profileId,
      index,
      clientId,
      stream,
      baseVersionId: slot.headVersionId,
      contentHash: null,
      archiveSha256: null,
      declaredSize: null,
      fileCount: null,
      manifestHash: null,
      clientMutationId: null,
      kind: SaveVersionKind.Backup,
      metadata: { legacyPush: true },
    });
  }

  async restoreVersion(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    versionId: string,
    baseVersionId: string | null,
    clientId: string,
  ): Promise<SaveVersionDto> {
    const source = await this.requireVersion(
      userId,
      profileId,
      gameId,
      index,
      versionId,
    );
    await this.requireSlot(userId, profileId, gameId, index);

    const restoredId = randomUUID();
    const metadata: Prisma.InputJsonValue = {
      ...(source.metadata as Record<string, unknown>),
      restoredFrom: source.id,
      restoredBy: clientId,
    } as Prisma.InputJsonValue;

    let prunedObjectIds: string[] = [];
    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.saveSlot.updateMany({
        where: {
          userId,
          profileId,
          gameId,
          index,
          headVersionId: baseVersionId,
        },
        data: {
          headVersionId: restoredId,
          lastUsedClientId: clientId,
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        const current = await tx.saveSlot.findUnique({
          where: { id: { userId, profileId, gameId, index } },
          select: { headVersionId: true },
        });
        throw new SaveConflictError(current?.headVersionId ?? null);
      }

      const version = await tx.saveVersion.create({
        data: {
          id: restoredId,
          gameId,
          userId,
          profileId,
          slotIndex: index,
          objectId: source.objectId,
          archiveSha256: source.archiveSha256,
          contentHash: source.contentHash,
          sizeBytes: source.sizeBytes,
          fileCount: source.fileCount,
          parentVersionId: baseVersionId,
          restoredFromVersionId: source.id,
          createdByClientId: clientId,
          kind: SaveVersionKind.Restore,
          archiveFormat: source.archiveFormat,
          manifestHash: source.manifestHash,
          metadata,
        },
      });

      prunedObjectIds = await this.pruneVersions(
        tx,
        userId,
        profileId,
        gameId,
        index,
        restoredId,
      );
      return version;
    });

    await this.garbageCollectObjects(prunedObjectIds);
    return toSaveVersionDto(restored);
  }

  async setPinned(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    versionId: string,
    pinned: boolean,
  ): Promise<SaveVersionDto> {
    const version = await this.requireVersion(
      userId,
      profileId,
      gameId,
      index,
      versionId,
    );
    const updated = await prisma.saveVersion.updateManyAndReturn({
      where: { id: version.id, userId, profileId, gameId, slotIndex: index },
      data: { pinned },
    });
    const [pinnedVersion] = updated;
    if (!pinnedVersion)
      throw createError({
        statusCode: 404,
        statusMessage: "Save version not found",
      });
    return toSaveVersionDto(pinnedVersion);
  }

  async deleteVersion(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
    versionId: string,
  ): Promise<void> {
    const version = await this.requireVersion(
      userId,
      profileId,
      gameId,
      index,
      versionId,
    );

    // Re-read the head inside the transaction: a concurrent restore must not be
    // able to make this delete remove the version a device just promoted.
    const deleted = await prisma.$transaction(async (tx) => {
      const slot = await tx.saveSlot.findUnique({
        where: { id: { userId, profileId, gameId, index } },
        select: { headVersionId: true },
      });
      if (!slot)
        throw createError({ statusCode: 404, statusMessage: "Save not found" });
      if (slot.headVersionId === version.id)
        throw createError({
          statusCode: 400,
          statusMessage: "Cannot delete the current save version",
        });
      return tx.saveVersion.deleteMany({
        where: { id: version.id, userId, profileId, gameId, slotIndex: index },
      });
    });
    if (deleted.count === 0)
      throw createError({
        statusCode: 404,
        statusMessage: "Save version not found",
      });

    await this.garbageCollectObjects([version.objectId]);
  }

  async deleteSlot(
    userId: string,
    profileId: string,
    gameId: string,
    index: number,
  ): Promise<void> {
    await this.requireSlot(userId, profileId, gameId, index);
    const versions = await prisma.saveVersion.findMany({
      where: { userId, profileId, gameId, slotIndex: index },
      select: { objectId: true },
    });
    const { count } = await prisma.saveSlot.deleteMany({
      where: { userId, profileId, gameId, index },
    });
    if (count === 0)
      throw createError({ statusCode: 404, statusMessage: "Save not found" });
    await this.garbageCollectObjects(
      versions.map((version) => version.objectId),
    );
  }

  async manifestForGame(gameId: string): Promise<{
    gameId: string;
    entry: Prisma.JsonValue;
    source: string;
    ludusaviName: string | null;
    entryHash: string;
    updatedAt: Date;
  }> {
    const manifest: SaveManifestModel | null =
      await prisma.saveManifest.findUnique({ where: { gameId } });
    if (!manifest)
      throw createError({
        statusCode: 404,
        statusMessage: "No save manifest for this game",
      });

    return {
      gameId: manifest.gameId,
      entry: manifest.entry,
      source: manifest.source,
      ludusaviName: manifest.ludusaviName,
      entryHash: createHash("sha256")
        .update(canonicalize(manifest.entry))
        .digest("hex"),
      updatedAt: manifest.updatedAt,
    };
  }
}

export const saveManager = new SaveManager();
export default saveManager;
