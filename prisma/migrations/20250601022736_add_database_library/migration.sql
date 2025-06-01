/*
  Warnings:

  - You are about to drop the `ClientPeerAPIConfiguration` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "LibraryBackend" AS ENUM ('Filesystem');

-- AlterEnum
ALTER TYPE "ClientCapabilities" ADD VALUE 'trackPlaytime';

-- DropForeignKey
ALTER TABLE "ClientPeerAPIConfiguration" DROP CONSTRAINT "ClientPeerAPIConfiguration_clientId_fkey";

-- AlterTable
ALTER TABLE "Screenshot" ALTER COLUMN "private" DROP DEFAULT;

-- DropTable
DROP TABLE "ClientPeerAPIConfiguration";

-- CreateTable
CREATE TABLE "Library" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "backend" "LibraryBackend" NOT NULL,
    "options" JSONB NOT NULL,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playtime" (
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Playtime_pkey" PRIMARY KEY ("gameId","userId")
);

-- CreateIndex
CREATE INDEX "Playtime_userId_idx" ON "Playtime"("userId");

-- CreateIndex
CREATE INDEX "Screenshot_userId_idx" ON "Screenshot"("userId");

-- AddForeignKey
ALTER TABLE "Playtime" ADD CONSTRAINT "Playtime_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playtime" ADD CONSTRAINT "Playtime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
