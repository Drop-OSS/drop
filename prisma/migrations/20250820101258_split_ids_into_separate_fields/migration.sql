/*
  Warnings:

  - You are about to drop the column `rootId` on the `Version` table. All the data in the column will be lost.

*/
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
ALTER TABLE "public"."Version" DROP COLUMN "rootId",
ADD COLUMN     "addonId" TEXT,
ADD COLUMN     "gameId" TEXT,
ADD COLUMN     "modId" TEXT,
ADD COLUMN     "redistId" TEXT;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "game_link" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "redist_link" FOREIGN KEY ("redistId") REFERENCES "public"."Redist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "addon_link" FOREIGN KEY ("addonId") REFERENCES "public"."Addon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "mod_link" FOREIGN KEY ("modId") REFERENCES "public"."Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
