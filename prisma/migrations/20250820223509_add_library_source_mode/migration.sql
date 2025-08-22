-- DropIndex
DROP INDEX "public"."GameTag_name_idx";

-- AlterTable
ALTER TABLE "public"."Library" ADD COLUMN     "mode" "public"."LibraryMode" NOT NULL DEFAULT 'Game';

-- CreateIndex
CREATE INDEX "GameTag_name_idx" ON "public"."GameTag" USING GIST ("name" gist_trgm_ops(siglen=32));
