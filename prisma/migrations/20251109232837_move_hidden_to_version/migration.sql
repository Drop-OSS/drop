/*
  Warnings:

  - You are about to drop the column `hidden` on the `GameVersion` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."GameVersion" DROP COLUMN "hidden";

-- AlterTable
ALTER TABLE "public"."Version" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
