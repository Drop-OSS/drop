-- DropForeignKey
ALTER TABLE "CollectionEntry" DROP CONSTRAINT "CollectionEntry_gameId_fkey";

-- AddForeignKey
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
