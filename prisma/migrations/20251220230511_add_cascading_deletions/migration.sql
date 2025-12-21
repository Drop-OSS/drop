-- DropForeignKey
ALTER TABLE "LaunchConfiguration" DROP CONSTRAINT "LaunchConfiguration_executorId_fkey";

-- DropForeignKey
ALTER TABLE "LaunchConfiguration" DROP CONSTRAINT "LaunchConfiguration_gameId_versionId_fkey";

-- DropForeignKey
ALTER TABLE "SetupConfiguration" DROP CONSTRAINT "SetupConfiguration_gameId_versionId_fkey";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "SetupConfiguration" ADD CONSTRAINT "SetupConfiguration_gameId_versionId_fkey" FOREIGN KEY ("gameId", "versionId") REFERENCES "GameVersion"("gameId", "versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchConfiguration" ADD CONSTRAINT "LaunchConfiguration_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "LaunchConfiguration"("launchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchConfiguration" ADD CONSTRAINT "LaunchConfiguration_gameId_versionId_fkey" FOREIGN KEY ("gameId", "versionId") REFERENCES "GameVersion"("gameId", "versionId") ON DELETE CASCADE ON UPDATE CASCADE;
