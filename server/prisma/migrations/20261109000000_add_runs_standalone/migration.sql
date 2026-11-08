-- Launcher handoff model: whether a build starts on its own or needs its
-- store client running first. True = direct exec; false = the launch path
-- hands off to the storefront. Defaults true because self-starting content
-- (DRM-free, anonymous-EOS, cracked builds included) is the common case and
-- the publisher flips it for launcher-gated titles.
-- Resumable: Prisma applies migration SQL statement-by-statement without a
-- wrapping transaction on this fork, so every statement must be safe to
-- re-run after a partial failure.

-- AlterTable
ALTER TABLE "GameVersion" ADD COLUMN IF NOT EXISTS "runsStandalone" BOOLEAN NOT NULL DEFAULT true;
