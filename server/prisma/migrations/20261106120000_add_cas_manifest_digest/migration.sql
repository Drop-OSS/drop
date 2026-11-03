-- Content-addressed releases: the digest of the `gamedepot-droplet` manifest a
-- version has been chunked into, '' when it never has been.
-- Resumable: Prisma applies migration SQL statement-by-statement without a
-- wrapping transaction on this fork, so every statement must be safe to
-- re-run after a partial failure.

-- AlterTable
ALTER TABLE "GameVersion" ADD COLUMN IF NOT EXISTS "casManifestDigest" TEXT NOT NULL DEFAULT '';
