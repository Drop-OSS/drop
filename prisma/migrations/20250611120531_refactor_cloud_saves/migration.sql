/*
  Warnings:

  - You are about to drop the column `ludusaviEntryName` on the `Game` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CloudSaveType" AS ENUM ('Ludusavi', 'LuaScript');

-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_ludusaviEntryName_fkey";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "ludusaviEntryName";

-- CreateTable
CREATE TABLE "CloudSaveConfiguration" (
    "gameId" TEXT NOT NULL,
    "type" "CloudSaveType" NOT NULL,
    "ludusaviEntryName" TEXT,
    "scriptContent" TEXT,

    CONSTRAINT "CloudSaveConfiguration_pkey" PRIMARY KEY ("gameId")
);

-- AddForeignKey
ALTER TABLE "CloudSaveConfiguration" ADD CONSTRAINT "CloudSaveConfiguration_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudSaveConfiguration" ADD CONSTRAINT "CloudSaveConfiguration_ludusaviEntryName_fkey" FOREIGN KEY ("ludusaviEntryName") REFERENCES "LudusaviEntry"("name") ON DELETE SET NULL ON UPDATE CASCADE;
