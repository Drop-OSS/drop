/*
  Warnings:

  - You are about to drop the column `userPlatformId` on the `PlatformLink` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PlatformLink" DROP CONSTRAINT "PlatformLink_userPlatformId_fkey";

-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."PlatformLink" DROP COLUMN "userPlatformId";

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "public"."PlatformLink" ADD CONSTRAINT "PlatformLink_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."UserPlatform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
