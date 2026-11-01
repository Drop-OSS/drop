-- The depot models (depot.prisma) shipped from upstream without a migration;
-- this creates them for real. The StoreProvider enum gains UBISOFT and EA,
-- which this fork's ingestion providers need and upstream never had.

-- CreateEnum
CREATE TYPE "StoreProvider" AS ENUM ('GOG', 'EPIC', 'STEAM', 'UBISOFT', 'EA');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'SYNCING', 'ERROR', 'COMPLETED');

-- CreateTable
CREATE TABLE "StoreConnection" (
    "id" TEXT NOT NULL,
    "provider" "StoreProvider" NOT NULL,
    "accountId" TEXT NOT NULL,
    "username" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "autoSync" BOOLEAN NOT NULL DEFAULT true,
    "status" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "lastSync" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreManifest" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalGameId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "image" TEXT,
    "version" TEXT,
    "payload" JSONB,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "localContentId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreManifest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreConnection_provider_accountId_key" ON "StoreConnection"("provider", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreManifest_connectionId_externalGameId_key" ON "StoreManifest"("connectionId", "externalGameId");

-- CreateIndex
CREATE INDEX "StoreManifest_externalGameId_idx" ON "StoreManifest"("externalGameId");

-- AddForeignKey
ALTER TABLE "StoreManifest" ADD CONSTRAINT "StoreManifest_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "StoreConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
