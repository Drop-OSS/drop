/*
  Warnings:

  - You are about to drop the column `ipConfigurations` on the `ClientPeerAPIConfiguration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClientPeerAPIConfiguration" DROP COLUMN "ipConfigurations",
ADD COLUMN     "endpoints" TEXT[];
