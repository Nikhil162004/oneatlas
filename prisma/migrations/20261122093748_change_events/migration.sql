-- DropIndex
DROP INDEX "lab_name_trgm";

-- DropIndex
DROP INDEX "model_name_trgm";

-- DropIndex
DROP INDEX "model_slug_trgm";

-- DropIndex
DROP INDEX "provider_name_trgm";

-- CreateTable
CREATE TABLE "ChangeEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "modelSlug" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "detail" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeEvent_createdAt_idx" ON "ChangeEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ChangeEvent_modelSlug_createdAt_idx" ON "ChangeEvent"("modelSlug", "createdAt");

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
