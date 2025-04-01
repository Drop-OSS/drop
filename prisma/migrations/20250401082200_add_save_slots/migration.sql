-- AlterEnum
ALTER TYPE "ClientCapabilities" ADD VALUE 'save';

-- CreateTable
CREATE TABLE "SaveSlot" (
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playtime" DOUBLE PRECISION NOT NULL,
    "lastUsedClientId" TEXT NOT NULL,
    "data" TEXT[],

    CONSTRAINT "SaveSlot_pkey" PRIMARY KEY ("gameId","userId","index")
);

-- AddForeignKey
ALTER TABLE "SaveSlot" ADD CONSTRAINT "SaveSlot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaveSlot" ADD CONSTRAINT "SaveSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaveSlot" ADD CONSTRAINT "SaveSlot_lastUsedClientId_fkey" FOREIGN KEY ("lastUsedClientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
