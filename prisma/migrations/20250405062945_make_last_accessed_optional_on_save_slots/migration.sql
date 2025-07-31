-- DropForeignKey
ALTER TABLE "SaveSlot" DROP CONSTRAINT "SaveSlot_lastUsedClientId_fkey";

-- AlterTable
ALTER TABLE "SaveSlot" ALTER COLUMN "lastUsedClientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SaveSlot" ADD CONSTRAINT "SaveSlot_lastUsedClientId_fkey" FOREIGN KEY ("lastUsedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
