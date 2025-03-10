/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `APIToken` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "APIToken_token_key" ON "APIToken"("token");
