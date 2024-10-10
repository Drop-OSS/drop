/*
  Warnings:

  - A unique constraint covering the columns `[libraryBasePath]` on the table `Game` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `libraryBasePath` to the `Game` table without a default value. This is not possible if the table is not empty.
  - Added the required column `versionOrder` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "libraryBasePath" TEXT NOT NULL,
ADD COLUMN     "versionOrder" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "GameVersion" (
    "gameId" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,

    CONSTRAINT "GameVersion_pkey" PRIMARY KEY ("gameId","versionName")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_libraryBasePath_key" ON "Game"("libraryBasePath");

-- AddForeignKey
ALTER TABLE "GameVersion" ADD CONSTRAINT "GameVersion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
