/*
  Warnings:

  - You are about to drop the column `executorId` on the `LaunchConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `executorSuggestions` on the `LaunchConfiguration` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "LaunchConfiguration" DROP CONSTRAINT "LaunchConfiguration_executorId_fkey";

-- DropIndex
DROP INDEX "Game_mName_idx";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "LaunchConfiguration" DROP COLUMN "executorId",
DROP COLUMN "executorSuggestions",
ADD COLUMN     "emulatorId" TEXT,
ADD COLUMN     "emulatorSuggestions" TEXT[];

-- CreateIndex
CREATE INDEX "Game_mName_idx" ON "Game" USING GIST ("mName" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "LaunchConfiguration" ADD CONSTRAINT "LaunchConfiguration_emulatorId_fkey" FOREIGN KEY ("emulatorId") REFERENCES "LaunchConfiguration"("launchId") ON DELETE SET NULL ON UPDATE CASCADE;
