-- DropForeignKey
ALTER TABLE "public"."Version" DROP CONSTRAINT "addon_link";

-- DropForeignKey
ALTER TABLE "public"."Version" DROP CONSTRAINT "game_link";

-- DropForeignKey
ALTER TABLE "public"."Version" DROP CONSTRAINT "mod_link";

-- DropForeignKey
ALTER TABLE "public"."Version" DROP CONSTRAINT "redist_link";

-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."GameVersion" ADD COLUMN     "setupArgs" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "public"."GameVersionLaunch" ADD COLUMN     "launchArgs" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "game_link" FOREIGN KEY ("rootId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "redist_link" FOREIGN KEY ("rootId") REFERENCES "public"."Redist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "addon_link" FOREIGN KEY ("rootId") REFERENCES "public"."Addon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "mod_link" FOREIGN KEY ("rootId") REFERENCES "public"."Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
