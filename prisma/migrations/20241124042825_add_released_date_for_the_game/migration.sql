/*
  Warnings:

  - Added the required column `mReleased` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "mReleased" TIMESTAMP(3) NOT NULL;
