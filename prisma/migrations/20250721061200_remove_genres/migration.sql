/*
  Warnings:

  - You are about to drop the column `genres` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "genres";

-- DropEnum
DROP TYPE "Genre";
