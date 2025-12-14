/*
  Warnings:

  - The primary key for the `GameVersion` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `versionName` on the `GameVersion` table. All the data in the column will be lost.
  - Made the column `libraryId` on table `Game` required. This step will fail if there are existing NULL values in that column.
  - The required column `versionId` was added to the `GameVersion` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `versionPath` to the `GameVersion` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "Game" ALTER COLUMN "libraryId" SET NOT NULL;

DELETE FROM "GameVersion";

-- AlterTable
ALTER TABLE "GameVersion" DROP CONSTRAINT "GameVersion_pkey",
DROP COLUMN "versionName",
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "versionId" TEXT NOT NULL,
ADD COLUMN     "versionPath" TEXT NOT NULL,
ADD CONSTRAINT "GameVersion_pkey" PRIMARY KEY ("gameId", "versionId");

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
