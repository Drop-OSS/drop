-- Add pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create index for tag names
-- CREATE INDEX trgm_tag_name ON "Tag" USING GIST (name gist_trgm_ops(siglen=32));
