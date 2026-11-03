-- Game title logo: an optional transparent cut-out the desktop hero renders
-- instead of the plain text name.
-- Resumable: Prisma applies migration SQL statement-by-statement without a
-- wrapping transaction on this fork, so every statement must be safe to
-- re-run after a partial failure.

-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "mLogoObjectId" TEXT NOT NULL DEFAULT '';
