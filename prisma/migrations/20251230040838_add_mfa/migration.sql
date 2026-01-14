-- CreateEnum
CREATE TYPE "MFAMec" AS ENUM ('WebAuthn', 'TOTP');

-- DropIndex
DROP INDEX "GameTag_name_idx";

-- CreateTable
CREATE TABLE "LinkedMFAMec" (
    "userId" TEXT NOT NULL,
    "mec" "MFAMec" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "credentials" JSONB NOT NULL,

    CONSTRAINT "LinkedMFAMec_pkey" PRIMARY KEY ("userId","mec")
);

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));

-- AddForeignKey
ALTER TABLE "LinkedMFAMec" ADD CONSTRAINT "LinkedMFAMec_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
