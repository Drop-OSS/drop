/*
  Warnings:

  - A unique constraint covering the columns `[installRId]` on the table `LaunchOption` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uninstallRId]` on the table `LaunchOption` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[installId]` on the table `RedistVersion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uninstallId]` on the table `RedistVersion` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."LaunchOption" ADD COLUMN     "installRId" TEXT,
ADD COLUMN     "uninstallRId" TEXT;

-- AlterTable
ALTER TABLE "public"."RedistVersion" ADD COLUMN     "installId" TEXT,
ADD COLUMN     "onlySetup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "uninstallId" TEXT;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE UNIQUE INDEX "LaunchOption_installRId_key" ON "public"."LaunchOption"("installRId");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchOption_uninstallRId_key" ON "public"."LaunchOption"("uninstallRId");

-- CreateIndex
CREATE UNIQUE INDEX "RedistVersion_installId_key" ON "public"."RedistVersion"("installId");

-- CreateIndex
CREATE UNIQUE INDEX "RedistVersion_uninstallId_key" ON "public"."RedistVersion"("uninstallId");

-- AddForeignKey
ALTER TABLE "public"."RedistVersion" ADD CONSTRAINT "RedistVersion_installId_fkey" FOREIGN KEY ("installId") REFERENCES "public"."LaunchOption"("launchId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RedistVersion" ADD CONSTRAINT "RedistVersion_uninstallId_fkey" FOREIGN KEY ("uninstallId") REFERENCES "public"."LaunchOption"("launchId") ON DELETE SET NULL ON UPDATE CASCADE;
