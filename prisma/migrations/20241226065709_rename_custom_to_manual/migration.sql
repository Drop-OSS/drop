/*
  Warnings:

  - The values [Custom] on the enum `MetadataSource` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MetadataSource_new" AS ENUM ('Manual', 'GiantBomb');
ALTER TABLE "Game" ALTER COLUMN "metadataSource" TYPE "MetadataSource_new" USING ("metadataSource"::text::"MetadataSource_new");
ALTER TABLE "Developer" ALTER COLUMN "metadataSource" TYPE "MetadataSource_new" USING ("metadataSource"::text::"MetadataSource_new");
ALTER TABLE "Publisher" ALTER COLUMN "metadataSource" TYPE "MetadataSource_new" USING ("metadataSource"::text::"MetadataSource_new");
ALTER TYPE "MetadataSource" RENAME TO "MetadataSource_old";
ALTER TYPE "MetadataSource_new" RENAME TO "MetadataSource";
DROP TYPE "MetadataSource_old";
COMMIT;
