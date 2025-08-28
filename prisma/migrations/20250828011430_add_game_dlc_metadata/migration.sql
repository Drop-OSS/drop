/*
  Warnings:

  - Added the required column `mReleased` to the `Mod` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."Mod" ADD COLUMN     "mReleased" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."GameDLCMetadata" (
    "id" TEXT NOT NULL,
    "mName" TEXT NOT NULL,
    "mShortDescription" TEXT NOT NULL,
    "mDescription" TEXT NOT NULL,
    "mIconObjectId" TEXT NOT NULL,
    "mBannerObjectId" TEXT NOT NULL,
    "mCoverObjectId" TEXT NOT NULL,
    "mImageCarouselObjectIds" TEXT[],
    "mImageLibraryObjectIds" TEXT[],

    CONSTRAINT "GameDLCMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "public"."GameDLCMetadata" ADD CONSTRAINT "GameDLCMetadata_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."DLC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
