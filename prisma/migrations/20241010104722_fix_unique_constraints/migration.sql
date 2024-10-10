/*
  Warnings:

  - A unique constraint covering the columns `[metadataSource,metadataId,metadataOriginalQuery]` on the table `Developer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[metadataSource,metadataId,metadataOriginalQuery]` on the table `Publisher` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Developer_metadataSource_metadataId_key";

-- DropIndex
DROP INDEX "Publisher_metadataSource_metadataId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Developer_metadataSource_metadataId_metadataOriginalQuery_key" ON "Developer"("metadataSource", "metadataId", "metadataOriginalQuery");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_metadataSource_metadataId_metadataOriginalQuery_key" ON "Publisher"("metadataSource", "metadataId", "metadataOriginalQuery");
