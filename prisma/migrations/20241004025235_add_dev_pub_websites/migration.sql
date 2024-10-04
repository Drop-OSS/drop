/*
  Warnings:

  - Added the required column `mWebsite` to the `Developer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mWebsite` to the `Publisher` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Developer" ADD COLUMN     "mWebsite" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Publisher" ADD COLUMN     "mWebsite" TEXT NOT NULL;
