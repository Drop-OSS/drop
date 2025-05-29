/*
  Warnings:

  - You are about to drop the column `mReviewCount` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `mReviewRating` on the `Game` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MetadataSource" ADD VALUE 'Metacritic';
ALTER TYPE "MetadataSource" ADD VALUE 'OpenCritic';

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "mReviewCount",
DROP COLUMN "mReviewRating";

-- CreateTable
CREATE TABLE "GameRating" (
    "id" TEXT NOT NULL,
    "metadataSource" "MetadataSource" NOT NULL,
    "metadataId" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mReviewCount" INTEGER NOT NULL,
    "mReviewRating" DOUBLE PRECISION NOT NULL,
    "mReviewHref" TEXT,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "GameRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameRating_metadataSource_metadataId_key" ON "GameRating"("metadataSource", "metadataId");

-- AddForeignKey
ALTER TABLE "GameRating" ADD CONSTRAINT "GameRating_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
