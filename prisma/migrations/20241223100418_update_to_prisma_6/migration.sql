-- AlterTable
ALTER TABLE "_DeveloperToGame" ADD CONSTRAINT "_DeveloperToGame_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_DeveloperToGame_AB_unique";

-- AlterTable
ALTER TABLE "_GameToPublisher" ADD CONSTRAINT "_GameToPublisher_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_GameToPublisher_AB_unique";
