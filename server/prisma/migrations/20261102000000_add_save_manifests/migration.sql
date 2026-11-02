-- SaveManifest: per-game save layout in Ludusavi-manifest-entry shape.
-- Keyed by gameId (one manifest per library game, cascading with it), mirroring
-- how SaveSlot already relates to Game. The `entry` column holds one Ludusavi
-- manifest entry verbatim so new upstream fields pass through without a
-- migration; see server/server/utils/saves/manifest.ts for the parser/validator.

-- CreateTable
CREATE TABLE "SaveManifest" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "entry" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'curated',
    "ludusaviName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaveManifest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaveManifest_gameId_key" ON "SaveManifest"("gameId");

-- AddForeignKey
ALTER TABLE "SaveManifest" ADD CONSTRAINT "SaveManifest_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
