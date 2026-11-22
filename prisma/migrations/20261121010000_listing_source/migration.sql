-- A listing's provenance, so "catalogue price" and "provider offer" stop being the same row.
CREATE TYPE "ListingSource" AS ENUM ('CATALOGUE', 'ENDPOINT');

ALTER TABLE "ModelListing" ADD COLUMN "source" "ListingSource" NOT NULL DEFAULT 'CATALOGUE';

-- Backfill: the endpoint branch is the only one that ever fills in quantisation, status, latency or
-- uptime, and it always names the endpoint. Anything else is the model-level fallback.
UPDATE "ModelListing"
   SET "source" = 'ENDPOINT'
 WHERE "endpointName" <> 'default'
    OR "quantization" IS NOT NULL
    OR "status" IS NOT NULL
    OR "latencyP50Ms" IS NOT NULL
    OR "uptimePct" IS NOT NULL;

CREATE INDEX "ModelListing_source_idx" ON "ModelListing"("source");
