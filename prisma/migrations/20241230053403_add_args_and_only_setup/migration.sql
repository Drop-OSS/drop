-- AlterTable
ALTER TABLE "GameVersion" ADD COLUMN     "launchArgs" TEXT[],
ADD COLUMN     "onlySetup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setupArgs" TEXT[],
ALTER COLUMN "launchCommand" DROP NOT NULL,
ALTER COLUMN "setupCommand" DROP NOT NULL;
