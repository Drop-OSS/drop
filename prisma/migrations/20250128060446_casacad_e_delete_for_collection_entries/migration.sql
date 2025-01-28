-- DropForeignKey
ALTER TABLE "CollectionEntry" DROP CONSTRAINT "CollectionEntry_collectionId_fkey";

-- AddForeignKey
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
