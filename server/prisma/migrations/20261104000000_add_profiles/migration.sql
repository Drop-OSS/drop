-- Multi-Profile support: one Profile per player within a user's account.
-- Playtime and cloud saves become profile-scoped; every existing user gets a
-- default profile ("Player") and all existing rows are attributed to it, so
-- the widening of the compound keys is data-preserving.
--
-- Ids in this fork are TEXT holding uuid strings (Prisma `String @default(uuid())`
-- with no @db.Uuid), so every new column here is TEXT too - matching the
-- existing schema exactly, since Prisma compares the two on every migrate.
--
-- Prisma applies this file statement-by-statement without a wrapping
-- transaction, and `migrate deploy` re-runs a rolled-back-by-hand migration
-- from its first line. Every step is therefore written to be safe to repeat:
-- IF [NOT] EXISTS guards everywhere, and backfills that only touch NULLs.

-- 1. The profile table itself.
CREATE TABLE IF NOT EXISTS "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Profile_userId_idx" ON "Profile"("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Profile_userId_fkey'
    ) THEN
        ALTER TABLE "Profile"
            ADD CONSTRAINT "Profile_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 2. One default profile per existing user (never one the account already
--    has). gen_random_uuid() is core in PostgreSQL 13+; the cast matches this
--    fork's TEXT id columns.
INSERT INTO "Profile" ("id", "userId", "name", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 'Player', true, now(), now()
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Profile" p WHERE p."userId" = u."id");

-- 3. Add the column everywhere, nullable until backfilled.
ALTER TABLE "Playtime" ADD COLUMN IF NOT EXISTS "profileId" TEXT;
ALTER TABLE "SaveSlot" ADD COLUMN IF NOT EXISTS "profileId" TEXT;
ALTER TABLE "SaveVersion" ADD COLUMN IF NOT EXISTS "profileId" TEXT;

-- 4. Attribute existing (still unattributed) play stats and save slots to
--    their user's default. The IS NULL guard keeps a re-run from moving rows
--    that already belong to a named profile.
UPDATE "Playtime" p
SET "profileId" = d."id"
FROM "Profile" d
WHERE d."userId" = p."userId" AND d."isDefault" AND p."profileId" IS NULL;

UPDATE "SaveSlot" s
SET "profileId" = d."id"
FROM "Profile" d
WHERE d."userId" = s."userId" AND d."isDefault" AND s."profileId" IS NULL;

-- 5. SaveSlot's compound primary key gains the profile dimension. The old
--    version->slot FK depends on that key, so it goes first; the widened FK
--    lands again in step 6. The key keeps its name ("id" in Prisma terms) so
--    no code that references the named key has to change.
ALTER TABLE "SaveVersion"
    DROP CONSTRAINT IF EXISTS "SaveVersion_gameId_userId_slotIndex_fkey";

DO $$
BEGIN
    -- Rebuild only while the key is still the 3-column one.
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'SaveSlot_pkey' AND array_length(conkey, 1) = 3
    ) THEN
        ALTER TABLE "SaveSlot" DROP CONSTRAINT "SaveSlot_pkey";
        ALTER TABLE "SaveSlot" ADD CONSTRAINT "SaveSlot_pkey"
            PRIMARY KEY ("gameId", "userId", "profileId", "index");
    END IF;
END $$;

-- 6. Versions inherit their slot's profile, then the slot FK, the
--    idempotency unique and the timeline index all widen to match.
UPDATE "SaveVersion" v
SET "profileId" = s."profileId"
FROM "SaveSlot" s
WHERE s."gameId" = v."gameId" AND s."userId" = v."userId" AND s."index" = v."slotIndex"
  AND v."profileId" IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'SaveVersion_gameId_userId_profileId_slotIndex_fkey'
    ) THEN
        ALTER TABLE "SaveVersion"
            ADD CONSTRAINT "SaveVersion_gameId_userId_profileId_slotIndex_fkey"
            FOREIGN KEY ("gameId", "userId", "profileId", "slotIndex")
            REFERENCES "SaveSlot"("gameId", "userId", "profileId", "index")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DROP INDEX IF EXISTS "SaveVersion_gameId_userId_slotIndex_clientMutationId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SaveVersion_gameId_userId_profileId_slotIndex_clientMutationId_key"
    ON "SaveVersion"("gameId", "userId", "profileId", "slotIndex", "clientMutationId");

DROP INDEX IF EXISTS "SaveVersion_gameId_userId_slotIndex_createdAt_idx";
CREATE INDEX IF NOT EXISTS "SaveVersion_gameId_userId_profileId_slotIndex_createdAt_idx"
    ON "SaveVersion"("gameId", "userId", "profileId", "slotIndex", "createdAt");

-- 7. The step-2 backfill gives every user a default, so a NULL at this point
--    means a row that could not be attributed to any user's profile at all
--    (only possible on corrupt data): drop it rather than strand it, then
--    make the columns required. Deleting a slot cascades to its versions.
DELETE FROM "SaveSlot" WHERE "profileId" IS NULL;
DELETE FROM "Playtime" WHERE "profileId" IS NULL;
DELETE FROM "SaveVersion" WHERE "profileId" IS NULL;

ALTER TABLE "Playtime" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "SaveSlot" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "SaveVersion" ALTER COLUMN "profileId" SET NOT NULL;

-- 8. Playtime's key widens, and the profile FKs land last so no half-state
--    above ever tripped over them.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Playtime_pkey' AND array_length(conkey, 1) = 2
    ) THEN
        ALTER TABLE "Playtime" DROP CONSTRAINT "Playtime_pkey";
        ALTER TABLE "Playtime" ADD CONSTRAINT "Playtime_pkey"
            PRIMARY KEY ("gameId", "userId", "profileId");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Playtime_profileId_idx" ON "Playtime"("profileId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Playtime_profileId_fkey'
    ) THEN
        ALTER TABLE "Playtime"
            ADD CONSTRAINT "Playtime_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SaveSlot_profileId_fkey'
    ) THEN
        ALTER TABLE "SaveSlot"
            ADD CONSTRAINT "SaveSlot_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
