-- SaveVersion: immutable, versioned cloud-save snapshots.
--
-- SaveSlot keeps its legacy historyObjectIds/historyChecksums arrays for one
-- release; this migration backfills them into SaveVersion rows so the new
-- service can serve version lists and conflict detection. `headVersionId` is a
-- soft reference (no FK) so the service can insert a version and move the head
-- in one transaction without a circular constraint.

-- CreateEnum
CREATE TYPE "SaveVersionKind" AS ENUM ('Backup', 'Restore', 'ConflictKeepLocal', 'Import', 'Legacy', 'Safety');

-- AlterTable
ALTER TABLE "SaveSlot"
    ADD COLUMN "label" TEXT,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "headVersionId" TEXT;

-- The default only exists to fill the existing rows; `@updatedAt` columns are
-- written by Prisma, and every other one in this schema has no DB default.
ALTER TABLE "SaveSlot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SaveVersion" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "objectId" TEXT NOT NULL,
    "archiveSha256" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "fileCount" INTEGER,
    "parentVersionId" TEXT,
    "restoredFromVersionId" TEXT,
    "createdByClientId" TEXT,
    "clientMutationId" TEXT,
    "kind" "SaveVersionKind" NOT NULL DEFAULT 'Backup',
    "archiveFormat" TEXT NOT NULL DEFAULT 'tar.zstd.v1',
    "manifestHash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaveVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaveSlot_headVersionId_key" ON "SaveSlot"("headVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SaveVersion_gameId_userId_slotIndex_clientMutationId_key" ON "SaveVersion"("gameId", "userId", "slotIndex", "clientMutationId");

-- CreateIndex
CREATE INDEX "SaveVersion_gameId_userId_slotIndex_createdAt_idx" ON "SaveVersion"("gameId", "userId", "slotIndex", "createdAt");

-- CreateIndex
CREATE INDEX "SaveVersion_objectId_idx" ON "SaveVersion"("objectId");

-- CreateIndex
CREATE INDEX "SaveVersion_contentHash_idx" ON "SaveVersion"("contentHash");

-- AddForeignKey
ALTER TABLE "SaveVersion" ADD CONSTRAINT "SaveVersion_gameId_userId_slotIndex_fkey" FOREIGN KEY ("gameId", "userId", "slotIndex") REFERENCES "SaveSlot"("gameId", "userId", "index") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one Legacy version per existing history entry, preserving order.
-- Old history stored only the archive checksum; use it for both hashes and
-- leave size/file count unknown.
INSERT INTO "SaveVersion" (
    "id",
    "gameId",
    "userId",
    "slotIndex",
    "objectId",
    "archiveSha256",
    "contentHash",
    "sizeBytes",
    "fileCount",
    "kind",
    "archiveFormat",
    "metadata",
    "createdAt"
)
SELECT
    gen_random_uuid()::text,
    s."gameId",
    s."userId",
    s."index",
    o.object_id,
    COALESCE(c.checksum, ''),
    COALESCE(c.checksum, ''),
    NULL,
    NULL,
    'Legacy'::"SaveVersionKind",
    'legacy',
    jsonb_build_object('legacy', true),
    s."createdAt" + (((o.ordinality - 1)::text) || ' seconds')::interval
FROM "SaveSlot" s
CROSS JOIN LATERAL unnest(s."historyObjectIds") WITH ORDINALITY AS o(object_id, ordinality)
LEFT JOIN LATERAL unnest(s."historyChecksums") WITH ORDINALITY AS c(checksum, ordinality)
    ON c.ordinality = o.ordinality
WHERE o.object_id IS NOT NULL AND o.object_id <> '';

-- Point each slot at its newest backfilled version.
UPDATE "SaveSlot" s
SET "headVersionId" = (
    SELECT v."id"
    FROM "SaveVersion" v
    WHERE v."gameId" = s."gameId"
      AND v."userId" = s."userId"
      AND v."slotIndex" = s."index"
    ORDER BY v."createdAt" DESC, v."id" DESC
    LIMIT 1
);
