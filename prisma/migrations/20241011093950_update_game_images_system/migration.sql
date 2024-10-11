/*
  Warnings:

  - You are about to drop the column `mArt` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `mBannerId` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `mScreenshots` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "mArt",
DROP COLUMN "mBannerId",
DROP COLUMN "mScreenshots",
ADD COLUMN     "mBannerIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mImageLibrary" TEXT[];
