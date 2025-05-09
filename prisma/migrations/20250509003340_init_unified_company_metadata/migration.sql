-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "metadataSource" "MetadataSource" NOT NULL,
    "metadataId" TEXT NOT NULL,
    "metadataOriginalQuery" TEXT NOT NULL,
    "mName" TEXT NOT NULL,
    "mShortDescription" TEXT NOT NULL,
    "mDescription" TEXT NOT NULL,
    "mLogoObjectId" TEXT NOT NULL,
    "mBannerObjectId" TEXT NOT NULL,
    "mWebsite" TEXT NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyGameRelation" (
    "companyId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "developer" BOOLEAN NOT NULL DEFAULT false,
    "publisher" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_metadataSource_metadataId_key" ON "Company"("metadataSource", "metadataId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyGameRelation_companyId_gameId_key" ON "CompanyGameRelation"("companyId", "gameId");

-- AddForeignKey
ALTER TABLE "CompanyGameRelation" ADD CONSTRAINT "CompanyGameRelation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyGameRelation" ADD CONSTRAINT "CompanyGameRelation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
