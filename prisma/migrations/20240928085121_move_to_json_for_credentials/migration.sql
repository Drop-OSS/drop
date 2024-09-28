/*
  Warnings:

  - Changed the type of `credentials` on the `LinkedAuthMec` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "LinkedAuthMec" DROP COLUMN "credentials",
ADD COLUMN     "credentials" JSONB NOT NULL;
