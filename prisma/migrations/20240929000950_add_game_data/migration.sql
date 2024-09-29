-- CreateEnum
CREATE TYPE "MetadataSource" AS ENUM ('Custom', 'GiantBomb');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "metadataSource" "MetadataSource" NOT NULL,
    "metadataId" TEXT NOT NULL,
    "mName" TEXT NOT NULL,
    "mShortDescription" TEXT NOT NULL,
    "mDescription" TEXT NOT NULL,
    "mReviewCount" INTEGER NOT NULL,
    "mReviewRating" DOUBLE PRECISION NOT NULL,
    "mIconId" TEXT NOT NULL,
    "mBannerId" TEXT NOT NULL,
    "mArt" TEXT[],
    "mScreenshots" TEXT[],

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL,
    "metadataSource" "MetadataSource" NOT NULL,
    "metadataId" TEXT NOT NULL,
    "mName" TEXT NOT NULL,

    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publisher" (
    "id" TEXT NOT NULL,
    "metadataSource" "MetadataSource" NOT NULL,
    "metadataId" TEXT NOT NULL,
    "mName" TEXT NOT NULL,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GameToPublisher" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_DeveloperToGame" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_GameToPublisher_AB_unique" ON "_GameToPublisher"("A", "B");

-- CreateIndex
CREATE INDEX "_GameToPublisher_B_index" ON "_GameToPublisher"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DeveloperToGame_AB_unique" ON "_DeveloperToGame"("A", "B");

-- CreateIndex
CREATE INDEX "_DeveloperToGame_B_index" ON "_DeveloperToGame"("B");

-- AddForeignKey
ALTER TABLE "_GameToPublisher" ADD CONSTRAINT "_GameToPublisher_A_fkey" FOREIGN KEY ("A") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToPublisher" ADD CONSTRAINT "_GameToPublisher_B_fkey" FOREIGN KEY ("B") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeveloperToGame" ADD CONSTRAINT "_DeveloperToGame_A_fkey" FOREIGN KEY ("A") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeveloperToGame" ADD CONSTRAINT "_DeveloperToGame_B_fkey" FOREIGN KEY ("B") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
