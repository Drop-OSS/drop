-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag" USING GIST ("name" gist_trgm_ops(siglen=32));
