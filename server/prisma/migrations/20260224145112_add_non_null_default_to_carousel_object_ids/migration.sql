-- DropIndex
DROP INDEX "Game_mName_idx";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "Game" ALTER COLUMN "mImageCarouselObjectIds" SET DEFAULT ARRAY[]::TEXT[];
UPDATE "Game" SET "mImageCarouselObjectIds" = '{}' WHERE "mImageCarouselObjectIds" IS NULL;

-- CreateEnum
CREATE TYPE "AgeRatingOrganization" AS ENUM ('ESRB', 'PEGI', 'CERO', 'USK', 'GRAC', 'ClassInd', 'ACB');

-- CreateTable
CREATE TABLE "GameAgeRating" (
    "id" TEXT NOT NULL,
    "organization" "AgeRatingOrganization" NOT NULL,
    "rating" TEXT NOT NULL,
    "ratingCoverUrl" TEXT,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "GameAgeRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameAgeRating_gameId_organization_key" ON "GameAgeRating"("gameId", "organization");

-- CreateIndex
CREATE INDEX "Game_mName_idx" ON "Game" USING GIST ("mName" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "GameAgeRating" ADD CONSTRAINT "GameAgeRating_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
