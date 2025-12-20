-- DropForeignKey
ALTER TABLE "GameVersion" DROP CONSTRAINT "GameVersion_setupId_fkey";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "GameVersion" ALTER COLUMN "setupId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "GameVersion" ADD CONSTRAINT "GameVersion_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "SetupConfiguration"("setupId") ON DELETE SET NULL ON UPDATE CASCADE;
