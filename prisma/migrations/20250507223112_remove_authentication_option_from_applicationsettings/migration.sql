/*
  Warnings:

  - You are about to drop the column `enabledAuthencationMechanisms` on the `ApplicationSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ApplicationSettings" DROP COLUMN "enabledAuthencationMechanisms";
