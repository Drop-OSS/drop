-- Per-user cloud-save quota: total MB a single user's save history may hold
-- across every game, profile and version (0 = unlimited).
-- Resumable: Prisma applies migration SQL statement-by-statement without a
-- wrapping transaction on this fork, so every statement must be safe to
-- re-run after a partial failure.

-- AlterTable
ALTER TABLE "ApplicationSettings" ADD COLUMN IF NOT EXISTS "saveUserStorageLimit" DOUBLE PRECISION NOT NULL DEFAULT 0;
