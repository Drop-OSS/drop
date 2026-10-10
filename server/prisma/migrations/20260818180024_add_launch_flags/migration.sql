/*
  Warnings:

  - You are about to drop the `_LibraryToUserGroup` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "LaunchFlag" AS ENUM ('BLOCK_NETWORK');

-- DropForeignKey
ALTER TABLE "_LibraryToUserGroup" DROP CONSTRAINT "_LibraryToUserGroup_A_fkey";

-- DropForeignKey
ALTER TABLE "_LibraryToUserGroup" DROP CONSTRAINT "_LibraryToUserGroup_B_fkey";

-- DropIndex
DROP INDEX "Game_mName_idx";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "LaunchConfiguration" ADD COLUMN     "flags" "LaunchFlag"[];

-- DropTable
DROP TABLE "_LibraryToUserGroup";

-- CreateIndex
CREATE INDEX "Game_mName_idx" ON "Game" USING GIST ("mName" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
