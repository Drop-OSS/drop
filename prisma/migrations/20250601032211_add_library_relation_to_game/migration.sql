/*
Warnings:

- You are about to drop the column `libraryBasePath` on the `Game` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Game_libraryBasePath_key";

-- AlterTable
ALTER TABLE "Game" RENAME COLUMN "libraryBasePath" TO "libraryPath";

ALTER TABLE "Game" ADD COLUMN "libraryId" TEXT;

-- AddForeignKey
ALTER TABLE "Game"
ADD CONSTRAINT "Game_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library" ("id") ON DELETE SET NULL ON UPDATE CASCADE;