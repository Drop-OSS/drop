/*
  Warnings:

  - The values [Addon] on the enum `LibraryMode` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `addonId` on the `Version` table. All the data in the column will be lost.
  - You are about to drop the `Addon` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AddonVersion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_AddonVersionToRedistVersion` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."LibraryMode_new" AS ENUM ('Game', 'Redist', 'DLC', 'Mod');
ALTER TABLE "public"."Library" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "public"."Library" ALTER COLUMN "mode" TYPE "public"."LibraryMode_new" USING ("mode"::text::"public"."LibraryMode_new");
ALTER TYPE "public"."LibraryMode" RENAME TO "LibraryMode_old";
ALTER TYPE "public"."LibraryMode_new" RENAME TO "LibraryMode";
DROP TYPE "public"."LibraryMode_old";
ALTER TABLE "public"."Library" ALTER COLUMN "mode" SET DEFAULT 'Game';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Addon" DROP CONSTRAINT "Addon_libraryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AddonVersion" DROP CONSTRAINT "AddonVersion_versionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Version" DROP CONSTRAINT "addon_link";

-- DropForeignKey
ALTER TABLE "public"."_AddonVersionToRedistVersion" DROP CONSTRAINT "_AddonVersionToRedistVersion_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_AddonVersionToRedistVersion" DROP CONSTRAINT "_AddonVersionToRedistVersion_B_fkey";

-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."Version" DROP COLUMN "addonId",
ADD COLUMN     "dlcId" TEXT;

-- DropTable
DROP TABLE "public"."Addon";

-- DropTable
DROP TABLE "public"."AddonVersion";

-- DropTable
DROP TABLE "public"."_AddonVersionToRedistVersion";

-- CreateTable
CREATE TABLE "public"."DLCVersion" (
    "versionId" TEXT NOT NULL,

    CONSTRAINT "DLCVersion_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "public"."DLC" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconObjectId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "libraryPath" TEXT NOT NULL,

    CONSTRAINT "DLC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_DLCVersionToRedistVersion" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DLCVersionToRedistVersion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DLCVersionToRedistVersion_B_index" ON "public"."_DLCVersionToRedistVersion"("B");

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "dlc_link" FOREIGN KEY ("dlcId") REFERENCES "public"."DLC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DLCVersion" ADD CONSTRAINT "DLCVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."Version"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DLC" ADD CONSTRAINT "DLC_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "public"."Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DLCVersionToRedistVersion" ADD CONSTRAINT "_DLCVersionToRedistVersion_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."DLCVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DLCVersionToRedistVersion" ADD CONSTRAINT "_DLCVersionToRedistVersion_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."RedistVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;
