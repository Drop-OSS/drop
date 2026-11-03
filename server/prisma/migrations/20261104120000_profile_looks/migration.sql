-- Profile looks: per-player colour and identicon avatar.
-- Resumable: Prisma applies migration SQL statement-by-statement without a
-- wrapping transaction on this fork, so every statement must be safe to
-- re-run after a partial failure.

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT 'blue';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "avatarObjectId" TEXT;
