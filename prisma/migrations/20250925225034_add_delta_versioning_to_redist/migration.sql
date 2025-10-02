/*
  Warnings:

  - Added the required column `versionIndex` to the `RedistVersion` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."RedistVersion" ADD COLUMN     "delta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "versionIndex" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
