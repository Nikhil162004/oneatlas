-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('TEXT', 'IMAGE', 'EMBEDDING', 'VIDEO', 'SPEECH', 'TRANSCRIPTION', 'RERANKING', 'REALTIME');

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "summary" TEXT,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "modelType" "ModelType" NOT NULL DEFAULT 'TEXT',
    "contextWindow" INTEGER NOT NULL,
    "maxOutputTokens" INTEGER,
    "inputModalities" TEXT[],
    "outputModalities" TEXT[],
    "supportsReasoning" BOOLEAN NOT NULL DEFAULT false,
    "supportsToolCalling" BOOLEAN NOT NULL DEFAULT false,
    "supportsStructuredOutput" BOOLEAN NOT NULL DEFAULT false,
    "supportsVisionInput" BOOLEAN NOT NULL DEFAULT false,
    "openWeights" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "releaseDate" TIMESTAMP(3),
    "deprecatedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelListing" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "endpointName" TEXT NOT NULL DEFAULT 'default',
    "promptPer1M" DECIMAL(14,6),
    "completionPer1M" DECIMAL(14,6),
    "cacheReadPer1M" DECIMAL(14,6),
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "quantization" TEXT,
    "latencyP50Ms" INTEGER,
    "throughputTps" INTEGER,
    "uptimePct" DECIMAL(5,2),
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,

    CONSTRAINT "ModelListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'score',
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkScore" (
    "benchmarkId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "sourceUrl" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkScore_pkey" PRIMARY KEY ("benchmarkId","modelId")
);

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsIn" INTEGER NOT NULL DEFAULT 0,
    "modelsUp" INTEGER NOT NULL DEFAULT 0,
    "listingsUp" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lab_slug_key" ON "Lab"("slug");

-- CreateIndex
CREATE INDEX "Lab_slug_idx" ON "Lab"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Model_slug_key" ON "Model"("slug");

-- CreateIndex
CREATE INDEX "Model_labId_idx" ON "Model"("labId");

-- CreateIndex
CREATE INDEX "Model_modelType_releaseDate_idx" ON "Model"("modelType", "releaseDate");

-- CreateIndex
CREATE INDEX "Model_releaseDate_idx" ON "Model"("releaseDate");

-- CreateIndex
CREATE INDEX "Model_contextWindow_idx" ON "Model"("contextWindow");

-- CreateIndex
CREATE INDEX "Model_deprecatedAt_idx" ON "Model"("deprecatedAt");

-- CreateIndex
CREATE INDEX "ModelListing_providerId_idx" ON "ModelListing"("providerId");

-- CreateIndex
CREATE INDEX "ModelListing_promptPer1M_idx" ON "ModelListing"("promptPer1M");

-- CreateIndex
CREATE UNIQUE INDEX "ModelListing_modelId_providerId_endpointName_key" ON "ModelListing"("modelId", "providerId", "endpointName");

-- CreateIndex
CREATE UNIQUE INDEX "Benchmark_slug_key" ON "Benchmark"("slug");

-- CreateIndex
CREATE INDEX "BenchmarkScore_benchmarkId_score_idx" ON "BenchmarkScore"("benchmarkId", "score");

-- CreateIndex
CREATE INDEX "IngestRun_source_startedAt_idx" ON "IngestRun"("source", "startedAt");

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelListing" ADD CONSTRAINT "ModelListing_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelListing" ADD CONSTRAINT "ModelListing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkScore" ADD CONSTRAINT "BenchmarkScore_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkScore" ADD CONSTRAINT "BenchmarkScore_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Applied by scripts/apply-search-sql.ts after `prisma migrate deploy`.
-- Prisma cannot express an operator class on an index, so the trigram indexes live here rather
-- than in schema.prisma. Kept idempotent so a re-run is harmless (same rule as the ingest).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS model_name_trgm ON "Model" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS model_slug_trgm ON "Model" USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS lab_name_trgm   ON "Lab"   USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS provider_name_trgm ON "Provider" USING gin ("name" gin_trgm_ops);
