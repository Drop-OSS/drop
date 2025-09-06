-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- DropEnum
DROP TYPE "public"."Platform";

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
