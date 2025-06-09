/*
  Warnings:

  - Added the required column `mCoverObjectId` to the `Company` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StoreComponentType" AS ENUM ('BigCarousel', 'SmallCarousel');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "mCoverObjectId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "StorePage" (
    "url" TEXT NOT NULL,
    "acls" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "StorePage_pkey" PRIMARY KEY ("url")
);

-- CreateTable
CREATE TABLE "StoreComponent" (
    "id" TEXT NOT NULL,
    "type" "StoreComponentType" NOT NULL,
    "configuration" JSONB NOT NULL,
    "pageUrl" TEXT,

    CONSTRAINT "StoreComponent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StoreComponent" ADD CONSTRAINT "StoreComponent_pageUrl_fkey" FOREIGN KEY ("pageUrl") REFERENCES "StorePage"("url") ON DELETE SET NULL ON UPDATE CASCADE;
