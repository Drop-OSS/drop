/*
  Warnings:

  - You are about to drop the column `platform` on the `PlatformLink` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."PlatformLink" DROP COLUMN "platform",
ADD COLUMN     "hardwarePlatform" "public"."HardwarePlatform";

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
