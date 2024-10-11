/*
  Warnings:

  - Added the required column `dropletManifest` to the `GameVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameVersion" ADD COLUMN     "dropletManifest" JSONB NOT NULL;
