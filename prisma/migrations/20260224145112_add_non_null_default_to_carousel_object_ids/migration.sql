-- DropIndex
DROP INDEX "Game_mName_idx";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "Game" ALTER COLUMN "mImageCarouselObjectIds" SET DEFAULT ARRAY[]::TEXT[];
UPDATE "Game" SET "mImageCarouselObjectIds" = '{}' WHERE "mImageCarouselObjectIds" IS NULL;

-- CreateIndex
CREATE INDEX "Game_mName_idx" ON "Game" USING GIST ("mName" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
