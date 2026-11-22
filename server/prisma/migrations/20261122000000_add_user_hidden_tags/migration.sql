-- CreateTable
CREATE TABLE "_UserHiddenTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserHiddenTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserHiddenTags_B_index" ON "_UserHiddenTags"("B");

-- AddForeignKey
ALTER TABLE "_UserHiddenTags" ADD CONSTRAINT "_UserHiddenTags_A_fkey" FOREIGN KEY ("A") REFERENCES "GameTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserHiddenTags" ADD CONSTRAINT "_UserHiddenTags_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
