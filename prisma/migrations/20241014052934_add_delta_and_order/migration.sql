/*
  Warnings:

  - Added the required column `versionIndex` to the `GameVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameVersion" ADD COLUMN     "delta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "versionIndex" INTEGER NOT NULL;
