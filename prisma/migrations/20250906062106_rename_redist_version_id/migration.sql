/*
  Warnings:

  - You are about to drop the column `versionId` on the `LaunchOption` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."LaunchOption" DROP CONSTRAINT "redistVersion_fkey";

-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."LaunchOption" DROP COLUMN "versionId",
ADD COLUMN     "redistVersionId" TEXT;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "public"."LaunchOption" ADD CONSTRAINT "redistVersion_fkey" FOREIGN KEY ("redistVersionId") REFERENCES "public"."RedistVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;
