-- DropForeignKey
ALTER TABLE "public"."AddonVersion" DROP CONSTRAINT "AddonVersion_versionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GameVersion" DROP CONSTRAINT "GameVersion_versionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GameVersionLaunch" DROP CONSTRAINT "GameVersionLaunch_versionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ModVersion" DROP CONSTRAINT "ModVersion_versionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RedistVersion" DROP CONSTRAINT "RedistVersion_versionId_fkey";

-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "public"."GameVersion" ADD CONSTRAINT "GameVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."Version"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameVersionLaunch" ADD CONSTRAINT "GameVersionLaunch_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."GameVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AddonVersion" ADD CONSTRAINT "AddonVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."Version"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RedistVersion" ADD CONSTRAINT "RedistVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."Version"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModVersion" ADD CONSTRAINT "ModVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."Version"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;
