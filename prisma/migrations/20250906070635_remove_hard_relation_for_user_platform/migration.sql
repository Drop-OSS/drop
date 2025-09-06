-- DropForeignKey
ALTER TABLE "public"."PlatformLink" DROP CONSTRAINT "PlatformLink_id_fkey";

-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
