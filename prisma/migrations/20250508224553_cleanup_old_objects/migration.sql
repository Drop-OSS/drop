
-- Rename game table columns
ALTER TABLE "Game" RENAME COLUMN "mIconId" TO "mIconObjectId";
ALTER TABLE "Game" RENAME COLUMN "mBannerId" TO "mBannerObjectId";
ALTER TABLE "Game" RENAME COLUMN "mCoverId" TO "mCoverObjectId";
ALTER TABLE "Game" RENAME COLUMN "mImageCarousel" TO "mImageCarouselObjectIds";
ALTER TABLE "Game" RENAME COLUMN "mImageLibrary" TO "mImageLibraryObjectIds";

-- Rename saveslot table columns
ALTER TABLE "SaveSlot" RENAME COLUMN "history" TO "historyObjectIds";
