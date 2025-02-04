-- CreateEnum
CREATE TYPE "APITokenMode" AS ENUM ('User', 'System');

-- CreateTable
CREATE TABLE "APIToken" (
    "token" TEXT NOT NULL,
    "mode" "APITokenMode" NOT NULL,
    "userId" TEXT,
    "acls" TEXT[],

    CONSTRAINT "APIToken_pkey" PRIMARY KEY ("token")
);

-- AddForeignKey
ALTER TABLE "APIToken" ADD CONSTRAINT "APIToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
