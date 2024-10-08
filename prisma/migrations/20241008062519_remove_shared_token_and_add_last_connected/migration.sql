/*
  Warnings:

  - The primary key for the `Client` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `sharedToken` on the `Client` table. All the data in the column will be lost.
  - The required column `id` was added to the `Client` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `lastConnected` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platform` to the `Client` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Client" DROP CONSTRAINT "Client_pkey",
DROP COLUMN "sharedToken",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "lastConnected" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "platform" TEXT NOT NULL,
ADD CONSTRAINT "Client_pkey" PRIMARY KEY ("id");
