/*
  Warnings:

  - You are about to drop the column `args` on the `LaunchConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `args` on the `SetupConfiguration` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Game_mName_idx";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "LaunchConfiguration" DROP COLUMN "args";

-- AlterTable
ALTER TABLE "SetupConfiguration" DROP COLUMN "args";

-- CreateIndex
CREATE INDEX "Game_mName_idx" ON "Game" USING GIST ("mName" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
