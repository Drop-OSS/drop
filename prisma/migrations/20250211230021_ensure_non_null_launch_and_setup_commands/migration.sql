/*
  Warnings:

  - Made the column `launchCommand` on table `GameVersion` required. This step will fail if there are existing NULL values in that column.
  - Made the column `setupCommand` on table `GameVersion` required. This step will fail if there are existing NULL values in that column.

*/
UPDATE "GameVersion"
SET "launchCommand" = ''
WHERE "launchCommand" is NULL;

UPDATE "GameVersion"
SET "setupCommand" = ''
WHERE "launchCommand" is NULL;

-- AlterTable
ALTER TABLE "GameVersion" ALTER COLUMN "launchCommand" SET NOT NULL,
ALTER COLUMN "launchCommand" SET DEFAULT '',
ALTER COLUMN "setupCommand" SET NOT NULL,
ALTER COLUMN "setupCommand" SET DEFAULT '';
