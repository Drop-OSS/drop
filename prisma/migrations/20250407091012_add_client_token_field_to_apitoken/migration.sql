-- AlterTable
ALTER TABLE "APIToken" ADD COLUMN     "clientId" TEXT;

-- AddForeignKey
ALTER TABLE "APIToken" ADD CONSTRAINT "APIToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
