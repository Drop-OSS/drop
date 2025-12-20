/*
  Warnings:

  - You are about to drop the column `launchArgs` on the `GameVersion` table. All the data in the column will be lost.
  - You are about to drop the column `launchCommand` on the `GameVersion` table. All the data in the column will be lost.
  - You are about to drop the column `platform` on the `GameVersion` table. All the data in the column will be lost.
  - You are about to drop the column `setupArgs` on the `GameVersion` table. All the data in the column will be lost.
  - You are about to drop the column `setupCommand` on the `GameVersion` table. All the data in the column will be lost.
  - You are about to drop the column `umuIdOverride` on the `GameVersion` table. All the data in the column will be lost.
  - Added the required column `setupId` to the `GameVersion` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "GameVersion" DROP COLUMN "launchArgs",
DROP COLUMN "launchCommand",
DROP COLUMN "platform",
DROP COLUMN "setupArgs",
DROP COLUMN "setupCommand",
DROP COLUMN "umuIdOverride",
ADD COLUMN     "setupId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "SetupConfiguration" (
    "setupId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "args" TEXT[],
    "platform" "Platform" NOT NULL,

    CONSTRAINT "SetupConfiguration_pkey" PRIMARY KEY ("setupId")
);

-- CreateTable
CREATE TABLE "LaunchConfiguration" (
    "launchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "args" TEXT[],
    "platform" "Platform" NOT NULL,
    "executorId" TEXT,
    "umuIdOverride" TEXT,
    "gameId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,

    CONSTRAINT "LaunchConfiguration_pkey" PRIMARY KEY ("launchId")
);

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "GameVersion" ADD CONSTRAINT "GameVersion_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "SetupConfiguration"("setupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchConfiguration" ADD CONSTRAINT "LaunchConfiguration_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "LaunchConfiguration"("launchId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchConfiguration" ADD CONSTRAINT "LaunchConfiguration_gameId_versionId_fkey" FOREIGN KEY ("gameId", "versionId") REFERENCES "GameVersion"("gameId", "versionId") ON DELETE RESTRICT ON UPDATE CASCADE;
