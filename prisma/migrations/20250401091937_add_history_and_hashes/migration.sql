/*
  Warnings:

  - You are about to drop the column `data` on the `SaveSlot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SaveSlot" DROP COLUMN "data",
ADD COLUMN     "history" TEXT[],
ADD COLUMN     "historyChecksums" TEXT[];
