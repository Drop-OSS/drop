/*
  Warnings:

  - A unique constraint covering the columns `[metadataSource,metadataId]` on the table `Developer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[metadataSource,metadataId]` on the table `Game` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[metadataSource,metadataId]` on the table `Publisher` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Developer_metadataSource_metadataId_key" ON "Developer"("metadataSource", "metadataId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_metadataSource_metadataId_key" ON "Game"("metadataSource", "metadataId");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_metadataSource_metadataId_key" ON "Publisher"("metadataSource", "metadataId");
