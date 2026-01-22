-- DropIndex
DROP INDEX "Game_mName_idx";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- AlterTable
ALTER TABLE "GameVersion" ALTER COLUMN "versionPath" DROP NOT NULL;

-- CreateTable
CREATE TABLE "UnimportedGameVersion" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,

    CONSTRAINT "UnimportedGameVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_mName_idx" ON "Game" USING GIST ("mName" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "UnimportedGameVersion" ADD CONSTRAINT "UnimportedGameVersion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
