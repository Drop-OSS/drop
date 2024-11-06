/*
  Warnings:

  - You are about to drop the column `endpoint` on the `Client` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Client" DROP COLUMN "endpoint";

-- CreateTable
CREATE TABLE "ClientPeerAPIConfiguration" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ipConfigurations" TEXT[],

    CONSTRAINT "ClientPeerAPIConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientPeerAPIConfiguration_clientId_key" ON "ClientPeerAPIConfiguration"("clientId");

-- AddForeignKey
ALTER TABLE "ClientPeerAPIConfiguration" ADD CONSTRAINT "ClientPeerAPIConfiguration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
