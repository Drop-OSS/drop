-- AlterTable
ALTER TABLE "ApplicationSettings" ADD COLUMN     "saveSlotCountLimit" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "saveSlotSizeLimit" DOUBLE PRECISION NOT NULL DEFAULT 10;
