-- CreateTable
CREATE TABLE "LudusaviEntry" (
    "name" TEXT NOT NULL,

    CONSTRAINT "LudusaviEntry_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "LudusaviPlatformEntry" (
    "ludusaviEntryName" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "files" TEXT[],
    "registry" TEXT[],

    CONSTRAINT "LudusaviPlatformEntry_pkey" PRIMARY KEY ("ludusaviEntryName","platform")
);

-- AddForeignKey
ALTER TABLE "LudusaviPlatformEntry" ADD CONSTRAINT "LudusaviPlatformEntry_ludusaviEntryName_fkey" FOREIGN KEY ("ludusaviEntryName") REFERENCES "LudusaviEntry"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
