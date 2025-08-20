-- DropIndex
DROP INDEX "GameTag_name_idx";

-- CreateTable
CREATE TABLE "RedistVersion" (
    "redistId" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" "Platform" NOT NULL,
    "dropletManifest" JSONB NOT NULL,

    CONSTRAINT "RedistVersion_pkey" PRIMARY KEY ("redistId","versionName")
);

-- CreateTable
CREATE TABLE "Redist" (
    "id" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconObjectId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "libraryPath" TEXT NOT NULL,

    CONSTRAINT "Redist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "RedistVersion" ADD CONSTRAINT "RedistVersion_redistId_fkey" FOREIGN KEY ("redistId") REFERENCES "Redist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redist" ADD CONSTRAINT "Redist_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
