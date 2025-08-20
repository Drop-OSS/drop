/*
  Warnings:

  - A unique constraint covering the columns `[libraryId,libraryPath]` on the table `Redist` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "GameTag_name_idx";

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE UNIQUE INDEX "Redist_libraryId_libraryPath_key" ON "Redist"("libraryId", "libraryPath");
