/*
  Warnings:

  - A unique constraint covering the columns `[userId,nonce]` on the table `Notification` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Notification_nonce_key";

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_nonce_key" ON "Notification"("userId", "nonce");
