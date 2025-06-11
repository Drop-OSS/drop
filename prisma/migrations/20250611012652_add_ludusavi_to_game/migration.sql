-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "ludusaviEntryName" TEXT;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_ludusaviEntryName_fkey" FOREIGN KEY ("ludusaviEntryName") REFERENCES "LudusaviEntry"("name") ON DELETE SET NULL ON UPDATE CASCADE;
