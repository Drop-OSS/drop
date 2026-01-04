-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
