-- DropForeignKey
ALTER TABLE "GameVersion" DROP CONSTRAINT "GameVersion_gameId_fkey";

-- AddForeignKey
ALTER TABLE "GameVersion" ADD CONSTRAINT "GameVersion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
