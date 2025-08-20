-- Add pg_trgm
CREATE EXTENSION pg_trgm;

-- CreateEnum
CREATE TYPE "public"."Platform" AS ENUM ('windows', 'linux', 'macos');

-- CreateEnum
CREATE TYPE "public"."LibraryBackend" AS ENUM ('Filesystem', 'FlatFilesystem');

-- CreateEnum
CREATE TYPE "public"."LibraryMode" AS ENUM ('Game', 'Redist', 'Addon', 'Mod');

-- CreateEnum
CREATE TYPE "public"."AuthMec" AS ENUM ('Simple', 'OpenID');

-- CreateEnum
CREATE TYPE "public"."APITokenMode" AS ENUM ('User', 'System', 'Client');

-- CreateEnum
CREATE TYPE "public"."ClientCapabilities" AS ENUM ('peerAPI', 'userStatus', 'cloudSaves', 'trackPlaytime');

-- CreateEnum
CREATE TYPE "public"."MetadataSource" AS ENUM ('Manual', 'GiantBomb', 'PCGamingWiki', 'IGDB', 'Metacritic', 'OpenCritic');

-- CreateTable
CREATE TABLE "public"."ApplicationSettings" (
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataProviders" TEXT[],
    "saveSlotCountLimit" INTEGER NOT NULL DEFAULT 5,
    "saveSlotSizeLimit" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "saveSlotHistoryLimit" INTEGER NOT NULL DEFAULT 3,
    "showGamePanelTextDecoration" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ApplicationSettings_pkey" PRIMARY KEY ("timestamp")
);

-- CreateTable
CREATE TABLE "public"."Library" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "backend" "public"."LibraryBackend" NOT NULL,
    "options" JSONB NOT NULL,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LinkedAuthMec" (
    "userId" TEXT NOT NULL,
    "mec" "public"."AuthMec" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "credentials" JSONB NOT NULL,

    CONSTRAINT "LinkedAuthMec_pkey" PRIMARY KEY ("userId","mec")
);

-- CreateTable
CREATE TABLE "public"."Invitation" (
    "id" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "email" TEXT,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."APIToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "mode" "public"."APITokenMode" NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "acls" TEXT[],

    CONSTRAINT "APIToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Certificate" (
    "id" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "certificate" TEXT NOT NULL,
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capabilities" "public"."ClientCapabilities"[],
    "name" TEXT NOT NULL,
    "platform" "public"."Platform" NOT NULL,
    "lastConnected" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CollectionEntry" (
    "collectionId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "CollectionEntry_pkey" PRIMARY KEY ("collectionId","gameId")
);

-- CreateTable
CREATE TABLE "public"."Version" (
    "versionId" TEXT NOT NULL,
    "rootId" TEXT NOT NULL,
    "versionPath" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" "public"."Platform" NOT NULL,
    "dropletManifest" JSONB NOT NULL,

    CONSTRAINT "Version_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "public"."GameVersion" (
    "versionId" TEXT NOT NULL,
    "setup" TEXT NOT NULL DEFAULT '',
    "onlySetup" BOOLEAN NOT NULL DEFAULT false,
    "umuIdOverride" TEXT,
    "versionIndex" INTEGER NOT NULL,
    "delta" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameVersion_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "public"."GameVersionLaunch" (
    "launchId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "launchCommand" TEXT NOT NULL,

    CONSTRAINT "GameVersionLaunch_pkey" PRIMARY KEY ("launchId")
);

-- CreateTable
CREATE TABLE "public"."AddonVersion" (
    "versionId" TEXT NOT NULL,

    CONSTRAINT "AddonVersion_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "public"."RedistVersion" (
    "versionId" TEXT NOT NULL,

    CONSTRAINT "RedistVersion_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "public"."ModVersion" (
    "versionId" TEXT NOT NULL,
    "dependencies" TEXT[],

    CONSTRAINT "ModVersion_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "public"."SaveSlot" (
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playtime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUsedClientId" TEXT,
    "historyObjectIds" TEXT[],
    "historyChecksums" TEXT[],

    CONSTRAINT "SaveSlot_pkey" PRIMARY KEY ("gameId","userId","index")
);

-- CreateTable
CREATE TABLE "public"."Screenshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Playtime" (
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Playtime_pkey" PRIMARY KEY ("gameId","userId")
);

-- CreateTable
CREATE TABLE "public"."ObjectHash" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "ObjectHash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Game" (
    "id" TEXT NOT NULL,
    "metadataSource" "public"."MetadataSource" NOT NULL,
    "metadataId" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mName" TEXT NOT NULL,
    "mShortDescription" TEXT NOT NULL,
    "mDescription" TEXT NOT NULL,
    "mReleased" TIMESTAMP(3) NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "mIconObjectId" TEXT NOT NULL,
    "mBannerObjectId" TEXT NOT NULL,
    "mCoverObjectId" TEXT NOT NULL,
    "mImageCarouselObjectIds" TEXT[],
    "mImageLibraryObjectIds" TEXT[],
    "libraryId" TEXT,
    "libraryPath" TEXT NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Addon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconObjectId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "libraryPath" TEXT NOT NULL,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Redist" (
    "id" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mName" TEXT NOT NULL,
    "mShortDescription" TEXT NOT NULL,
    "mIconObjectId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "libraryPath" TEXT NOT NULL,

    CONSTRAINT "Redist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Mod" (
    "id" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameId" TEXT NOT NULL,
    "user" BOOLEAN NOT NULL DEFAULT true,
    "mName" TEXT NOT NULL,
    "mShortDescription" TEXT NOT NULL,
    "mDescription" TEXT NOT NULL,
    "mIconObjectId" TEXT NOT NULL,
    "mBannerObjectId" TEXT NOT NULL,
    "mCoverObjectId" TEXT NOT NULL,
    "mImageCarouselObjectIds" TEXT[],
    "mImageLibraryObjectIds" TEXT[],
    "libraryId" TEXT NOT NULL,
    "libraryPath" TEXT NOT NULL,

    CONSTRAINT "Mod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GameTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GameTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GameRating" (
    "id" TEXT NOT NULL,
    "metadataSource" "public"."MetadataSource" NOT NULL,
    "metadataId" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mReviewCount" INTEGER NOT NULL,
    "mReviewRating" DOUBLE PRECISION NOT NULL,
    "mReviewHref" TEXT,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "GameRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "metadataSource" "public"."MetadataSource" NOT NULL,
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
CREATE TABLE "public"."NewsTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "NewsTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageObjectId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "taskGroup" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "started" TIMESTAMP(3) NOT NULL,
    "ended" TIMESTAMP(3) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" JSONB,
    "progress" DOUBLE PRECISION NOT NULL,
    "log" TEXT[],
    "acls" TEXT[],

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id","started")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "profilePictureObjectId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "nonce" TEXT,
    "userId" TEXT NOT NULL,
    "acls" TEXT[],
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actions" TEXT[],
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_GameVersionToRedistVersion" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameVersionToRedistVersion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_AddonVersionToRedistVersion" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AddonVersionToRedistVersion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_GameToGameTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameToGameTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_GameTagToMod" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameTagToMod_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_developers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_developers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_publishers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_publishers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_ArticleToNewsTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleToNewsTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "APIToken_token_key" ON "public"."APIToken"("token");

-- CreateIndex
CREATE INDEX "APIToken_token_idx" ON "public"."APIToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Version_versionId_key" ON "public"."Version"("versionId");

-- CreateIndex
CREATE INDEX "Screenshot_gameId_userId_idx" ON "public"."Screenshot"("gameId", "userId");

-- CreateIndex
CREATE INDEX "Screenshot_userId_idx" ON "public"."Screenshot"("userId");

-- CreateIndex
CREATE INDEX "Playtime_userId_idx" ON "public"."Playtime"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_metadataSource_metadataId_key" ON "public"."Game"("metadataSource", "metadataId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_libraryId_libraryPath_key" ON "public"."Game"("libraryId", "libraryPath");

-- CreateIndex
CREATE UNIQUE INDEX "Redist_libraryId_libraryPath_key" ON "public"."Redist"("libraryId", "libraryPath");

-- CreateIndex
CREATE UNIQUE INDEX "GameTag_name_key" ON "public"."GameTag"("name");

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- CreateIndex
CREATE UNIQUE INDEX "GameRating_metadataSource_metadataId_key" ON "public"."GameRating"("metadataSource", "metadataId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_metadataSource_metadataId_key" ON "public"."Company"("metadataSource", "metadataId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsTag_name_key" ON "public"."NewsTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_nonce_key" ON "public"."Notification"("userId", "nonce");

-- CreateIndex
CREATE INDEX "_GameVersionToRedistVersion_B_index" ON "public"."_GameVersionToRedistVersion"("B");

-- CreateIndex
CREATE INDEX "_AddonVersionToRedistVersion_B_index" ON "public"."_AddonVersionToRedistVersion"("B");

-- CreateIndex
CREATE INDEX "_GameToGameTag_B_index" ON "public"."_GameToGameTag"("B");

-- CreateIndex
CREATE INDEX "_GameTagToMod_B_index" ON "public"."_GameTagToMod"("B");

-- CreateIndex
CREATE INDEX "_developers_B_index" ON "public"."_developers"("B");

-- CreateIndex
CREATE INDEX "_publishers_B_index" ON "public"."_publishers"("B");

-- CreateIndex
CREATE INDEX "_ArticleToNewsTag_B_index" ON "public"."_ArticleToNewsTag"("B");

-- AddForeignKey
ALTER TABLE "public"."LinkedAuthMec" ADD CONSTRAINT "LinkedAuthMec_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."APIToken" ADD CONSTRAINT "APIToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."APIToken" ADD CONSTRAINT "APIToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CollectionEntry" ADD CONSTRAINT "CollectionEntry_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CollectionEntry" ADD CONSTRAINT "CollectionEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "game_link" FOREIGN KEY ("rootId") REFERENCES "public"."Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "redist_link" FOREIGN KEY ("rootId") REFERENCES "public"."Redist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "addon_link" FOREIGN KEY ("rootId") REFERENCES "public"."Addon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Version" ADD CONSTRAINT "mod_link" FOREIGN KEY ("rootId") REFERENCES "public"."Mod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameVersion" ADD CONSTRAINT "GameVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."Version"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameVersionLaunch" ADD CONSTRAINT "GameVersionLaunch_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."GameVersion"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AddonVersion" ADD CONSTRAINT "AddonVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."Version"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RedistVersion" ADD CONSTRAINT "RedistVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."Version"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModVersion" ADD CONSTRAINT "ModVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."Version"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaveSlot" ADD CONSTRAINT "SaveSlot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaveSlot" ADD CONSTRAINT "SaveSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaveSlot" ADD CONSTRAINT "SaveSlot_lastUsedClientId_fkey" FOREIGN KEY ("lastUsedClientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Screenshot" ADD CONSTRAINT "Screenshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Screenshot" ADD CONSTRAINT "Screenshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Playtime" ADD CONSTRAINT "Playtime_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Playtime" ADD CONSTRAINT "Playtime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Game" ADD CONSTRAINT "Game_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "public"."Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Addon" ADD CONSTRAINT "Addon_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "public"."Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Redist" ADD CONSTRAINT "Redist_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "public"."Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mod" ADD CONSTRAINT "Mod_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mod" ADD CONSTRAINT "Mod_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "public"."Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameRating" ADD CONSTRAINT "GameRating_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_GameVersionToRedistVersion" ADD CONSTRAINT "_GameVersionToRedistVersion_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."GameVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_GameVersionToRedistVersion" ADD CONSTRAINT "_GameVersionToRedistVersion_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."RedistVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_AddonVersionToRedistVersion" ADD CONSTRAINT "_AddonVersionToRedistVersion_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."AddonVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_AddonVersionToRedistVersion" ADD CONSTRAINT "_AddonVersionToRedistVersion_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."RedistVersion"("versionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_GameToGameTag" ADD CONSTRAINT "_GameToGameTag_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_GameToGameTag" ADD CONSTRAINT "_GameToGameTag_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."GameTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_GameTagToMod" ADD CONSTRAINT "_GameTagToMod_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."GameTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_GameTagToMod" ADD CONSTRAINT "_GameTagToMod_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_developers" ADD CONSTRAINT "_developers_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_developers" ADD CONSTRAINT "_developers_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_publishers" ADD CONSTRAINT "_publishers_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_publishers" ADD CONSTRAINT "_publishers_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ArticleToNewsTag" ADD CONSTRAINT "_ArticleToNewsTag_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ArticleToNewsTag" ADD CONSTRAINT "_ArticleToNewsTag_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."NewsTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
