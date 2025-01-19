/*
  Warnings:

  - You are about to drop the `_CollectionToGame` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CollectionToGame" DROP CONSTRAINT "_CollectionToGame_A_fkey";

-- DropForeignKey
ALTER TABLE "_CollectionToGame" DROP CONSTRAINT "_CollectionToGame_B_fkey";

-- DropTable
DROP TABLE "_CollectionToGame";

-- CreateTable
CREATE TABLE "CollectionEntry" (
    "collectionId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "CollectionEntry_pkey" PRIMARY KEY ("collectionId","gameId")
);

-- AddForeignKey
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
