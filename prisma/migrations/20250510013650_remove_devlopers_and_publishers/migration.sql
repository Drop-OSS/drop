/*
  Warnings:

  - You are about to drop the `CompanyGameRelation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Developer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Publisher` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_DeveloperToGame` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_GameToPublisher` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CompanyGameRelation" DROP CONSTRAINT "CompanyGameRelation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyGameRelation" DROP CONSTRAINT "CompanyGameRelation_gameId_fkey";

-- DropForeignKey
ALTER TABLE "_DeveloperToGame" DROP CONSTRAINT "_DeveloperToGame_A_fkey";

-- DropForeignKey
ALTER TABLE "_DeveloperToGame" DROP CONSTRAINT "_DeveloperToGame_B_fkey";

-- DropForeignKey
ALTER TABLE "_GameToPublisher" DROP CONSTRAINT "_GameToPublisher_A_fkey";

-- DropForeignKey
ALTER TABLE "_GameToPublisher" DROP CONSTRAINT "_GameToPublisher_B_fkey";

-- DropTable
DROP TABLE "CompanyGameRelation";

-- DropTable
DROP TABLE "Developer";

-- DropTable
DROP TABLE "Publisher";

-- DropTable
DROP TABLE "_DeveloperToGame";

-- DropTable
DROP TABLE "_GameToPublisher";

-- CreateTable
CREATE TABLE "_developers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_developers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_publishers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_publishers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_developers_B_index" ON "_developers"("B");

-- CreateIndex
CREATE INDEX "_publishers_B_index" ON "_publishers"("B");

-- AddForeignKey
ALTER TABLE "_developers" ADD CONSTRAINT "_developers_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_developers" ADD CONSTRAINT "_developers_B_fkey" FOREIGN KEY ("B") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_publishers" ADD CONSTRAINT "_publishers_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_publishers" ADD CONSTRAINT "_publishers_B_fkey" FOREIGN KEY ("B") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
