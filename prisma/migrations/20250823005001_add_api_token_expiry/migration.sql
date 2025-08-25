-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "APIToken" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
