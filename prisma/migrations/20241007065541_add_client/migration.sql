-- CreateEnum
CREATE TYPE "ClientCapabilities" AS ENUM ('DownloadAggregation');

-- CreateTable
CREATE TABLE "Client" (
    "sharedToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "capabilities" "ClientCapabilities"[],

    CONSTRAINT "Client_pkey" PRIMARY KEY ("sharedToken")
);

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
