/*
  Warnings:

  - You are about to drop the column `versionIndex` on the `GameVersion` table. All the data in the column will be lost.
  - Added the required column `versionIndex` to the `Version` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."GameVersion" DROP COLUMN "versionIndex";

-- AlterTable
ALTER TABLE "public"."Version" ADD COLUMN     "versionIndex" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
