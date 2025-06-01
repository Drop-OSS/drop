/*
  Warnings:

  - A unique constraint covering the columns `[libraryId,libraryPath]` on the table `Game` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Game_libraryId_libraryPath_key" ON "Game"("libraryId", "libraryPath");
