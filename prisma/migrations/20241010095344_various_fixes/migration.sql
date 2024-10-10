/*
  Warnings:

  - The `versionOrder` column on the `Game` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `platform` on the `Client` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `launchCommand` to the `GameVersion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platform` to the `GameVersion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `setupCommand` to the `GameVersion` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('windows', 'linux');

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "platform",
ADD COLUMN     "platform" "Platform" NOT NULL;

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "versionOrder",
ADD COLUMN     "versionOrder" TEXT[];

-- AlterTable
ALTER TABLE "GameVersion" ADD COLUMN     "launchCommand" TEXT NOT NULL,
ADD COLUMN     "platform" "Platform" NOT NULL,
ADD COLUMN     "setupCommand" TEXT NOT NULL;
