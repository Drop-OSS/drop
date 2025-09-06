/*
  Warnings:

  - Made the column `redistId` on table `UserPlatform` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."UserPlatform" DROP CONSTRAINT "UserPlatform_redistId_fkey";

-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."UserPlatform" ALTER COLUMN "redistId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "public"."UserPlatform" ADD CONSTRAINT "UserPlatform_redistId_fkey" FOREIGN KEY ("redistId") REFERENCES "public"."Redist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
