/*
  Warnings:

  - You are about to drop the column `setupId` on the `GameVersion` table. All the data in the column will be lost.
  - Added the required column `gameId` to the `SetupConfiguration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `versionId` to the `SetupConfiguration` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GameVersion" DROP CONSTRAINT "GameVersion_setupId_fkey";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "GameVersion" DROP COLUMN "setupId";

-- AlterTable
ALTER TABLE "SetupConfiguration" ADD COLUMN     "gameId" TEXT NOT NULL,
ADD COLUMN     "versionId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "SetupConfiguration" ADD CONSTRAINT "SetupConfiguration_gameId_versionId_fkey" FOREIGN KEY ("gameId", "versionId") REFERENCES "GameVersion"("gameId", "versionId") ON DELETE RESTRICT ON UPDATE CASCADE;
