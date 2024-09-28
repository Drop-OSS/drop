-- CreateEnum
CREATE TYPE "AuthMec" AS ENUM ('Simple');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedAuthMec" (
    "userId" TEXT NOT NULL,
    "mec" "AuthMec" NOT NULL,
    "credentials" TEXT[],

    CONSTRAINT "LinkedAuthMec_pkey" PRIMARY KEY ("userId","mec")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "LinkedAuthMec" ADD CONSTRAINT "LinkedAuthMec_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
