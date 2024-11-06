/*
  Warnings:

  - The values [DownloadAggregation] on the enum `ClientCapabilities` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ClientCapabilities_new" AS ENUM ('PeerAPI', 'UserStatus');
ALTER TABLE "Client" ALTER COLUMN "capabilities" TYPE "ClientCapabilities_new"[] USING ("capabilities"::text::"ClientCapabilities_new"[]);
ALTER TYPE "ClientCapabilities" RENAME TO "ClientCapabilities_old";
ALTER TYPE "ClientCapabilities_new" RENAME TO "ClientCapabilities";
DROP TYPE "ClientCapabilities_old";
COMMIT;
