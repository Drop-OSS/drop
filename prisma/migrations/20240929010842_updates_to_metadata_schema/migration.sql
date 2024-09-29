/*
  Warnings:

  - Added the required column `mBanner` to the `Developer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mDescription` to the `Developer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mLogo` to the `Developer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mShortDescription` to the `Developer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mBanner` to the `Publisher` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mDescription` to the `Publisher` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mLogo` to the `Publisher` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mShortDescription` to the `Publisher` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Developer" ADD COLUMN     "mBanner" TEXT NOT NULL,
ADD COLUMN     "mDescription" TEXT NOT NULL,
ADD COLUMN     "mLogo" TEXT NOT NULL,
ADD COLUMN     "mShortDescription" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Publisher" ADD COLUMN     "mBanner" TEXT NOT NULL,
ADD COLUMN     "mDescription" TEXT NOT NULL,
ADD COLUMN     "mLogo" TEXT NOT NULL,
ADD COLUMN     "mShortDescription" TEXT NOT NULL;
