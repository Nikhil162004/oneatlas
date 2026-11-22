-- Applied by scripts/apply-search-sql.ts after `prisma migrate deploy`.
-- Prisma cannot express an operator class on an index, so the trigram indexes live here rather
-- than in schema.prisma. Kept idempotent so a re-run is harmless (same rule as the ingest).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS model_name_trgm ON "Model" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS model_slug_trgm ON "Model" USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS lab_name_trgm   ON "Lab"   USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS provider_name_trgm ON "Provider" USING gin ("name" gin_trgm_ops);
