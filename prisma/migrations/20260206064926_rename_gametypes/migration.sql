/*
  Warnings:

  - The values [Executor,Redist] on the enum `GameType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "GameType_new" AS ENUM ('Game', 'Emulator', 'Dependency');
ALTER TABLE "Game" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Game" ALTER COLUMN "type" TYPE "GameType_new" USING ("type"::text::"GameType_new");
ALTER TYPE "GameType" RENAME TO "GameType_old";
ALTER TYPE "GameType_new" RENAME TO "GameType";
DROP TYPE "GameType_old";
ALTER TABLE "Game" ALTER COLUMN "type" SET DEFAULT 'Game';
COMMIT;

-- DropIndex
DROP INDEX "Game_mName_idx";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "LaunchConfiguration" ADD COLUMN     "umuStoreOverride" TEXT;

-- CreateIndex
CREATE INDEX "Game_mName_idx" ON "Game" USING GIST ("mName" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
