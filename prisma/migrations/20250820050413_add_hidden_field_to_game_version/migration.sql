-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."GameVersion" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
