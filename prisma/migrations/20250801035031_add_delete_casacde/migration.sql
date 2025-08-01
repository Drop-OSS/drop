-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_libraryId_fkey";

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
