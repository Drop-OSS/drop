/*
  Warnings:

  - Added the required column `name` to the `APIToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "APIToken" ADD COLUMN     "name" TEXT NOT NULL;
