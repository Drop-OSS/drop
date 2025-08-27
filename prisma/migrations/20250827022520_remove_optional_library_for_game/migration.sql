/*
  Warnings:

  - Made the column `libraryId` on table `Game` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."Game" ALTER COLUMN "libraryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
