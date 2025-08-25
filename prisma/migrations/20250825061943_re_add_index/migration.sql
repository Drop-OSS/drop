-- DropIndex
DROP INDEX "GameTag_name_idx";

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
