/*
  Warnings:

  - You are about to drop the `Tag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ArticleToTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_GameToTag` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ArticleToTag" DROP CONSTRAINT "_ArticleToTag_A_fkey";

-- DropForeignKey
ALTER TABLE "_ArticleToTag" DROP CONSTRAINT "_ArticleToTag_B_fkey";

-- DropForeignKey
ALTER TABLE "_GameToTag" DROP CONSTRAINT "_GameToTag_A_fkey";

-- DropForeignKey
ALTER TABLE "_GameToTag" DROP CONSTRAINT "_GameToTag_B_fkey";

-- DropTable
DROP TABLE "Tag";

-- DropTable
DROP TABLE "_ArticleToTag";

-- DropTable
DROP TABLE "_GameToTag";

-- CreateTable
CREATE TABLE "GameTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GameTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "NewsTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GameToGameTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameToGameTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ArticleToNewsTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleToNewsTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameTag_name_key" ON "GameTag"("name");

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE UNIQUE INDEX "NewsTag_name_key" ON "NewsTag"("name");

-- CreateIndex
CREATE INDEX "_GameToGameTag_B_index" ON "_GameToGameTag"("B");

-- CreateIndex
CREATE INDEX "_ArticleToNewsTag_B_index" ON "_ArticleToNewsTag"("B");

-- AddForeignKey
ALTER TABLE "_GameToGameTag" ADD CONSTRAINT "_GameToGameTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameToGameTag" ADD CONSTRAINT "_GameToGameTag_B_fkey" FOREIGN KEY ("B") REFERENCES "GameTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToNewsTag" ADD CONSTRAINT "_ArticleToNewsTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToNewsTag" ADD CONSTRAINT "_ArticleToNewsTag_B_fkey" FOREIGN KEY ("B") REFERENCES "NewsTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
