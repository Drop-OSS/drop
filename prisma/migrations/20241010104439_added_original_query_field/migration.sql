/*
  Warnings:

  - Added the required column `metadataOriginalQuery` to the `Developer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `metadataOriginalQuery` to the `Publisher` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Developer" ADD COLUMN     "metadataOriginalQuery" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Publisher" ADD COLUMN     "metadataOriginalQuery" TEXT NOT NULL;
