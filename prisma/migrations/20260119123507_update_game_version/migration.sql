/*
  Warnings:

  - The primary key for the `GameVersion` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `gameId` on the `LaunchConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `gameId` on the `SetupConfiguration` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "LaunchConfiguration" DROP CONSTRAINT "LaunchConfiguration_executorId_fkey";

-- DropForeignKey
ALTER TABLE "LaunchConfiguration" DROP CONSTRAINT "LaunchConfiguration_gameId_versionId_fkey";

-- DropForeignKey
ALTER TABLE "SetupConfiguration" DROP CONSTRAINT "SetupConfiguration_gameId_versionId_fkey";

-- DropIndex
DROP INDEX "Game_mName_idx";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "GameVersion" DROP CONSTRAINT "GameVersion_pkey",
ADD CONSTRAINT "GameVersion_pkey" PRIMARY KEY ("versionId");

-- AlterTable
ALTER TABLE "LaunchConfiguration" DROP COLUMN "gameId";

-- AlterTable
ALTER TABLE "SetupConfiguration" DROP COLUMN "gameId";

-- CreateTable
CREATE TABLE "_requiredContent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_requiredContent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_requiredContent_B_index" ON "_requiredContent"("B");

-- CreateIndex
CREATE INDEX "Game_mName_idx" ON "Game" USING GIST ("mName" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "SetupConfiguration" ADD CONSTRAINT "SetupConfiguration_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchConfiguration" ADD CONSTRAINT "LaunchConfiguration_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "LaunchConfiguration"("launchId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchConfiguration" ADD CONSTRAINT "LaunchConfiguration_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_requiredContent" ADD CONSTRAINT "_requiredContent_A_fkey" FOREIGN KEY ("A") REFERENCES "GameVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_requiredContent" ADD CONSTRAINT "_requiredContent_B_fkey" FOREIGN KEY ("B") REFERENCES "GameVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;
