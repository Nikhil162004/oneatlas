/**
 * Row counts, for "did the ingest actually change anything" and for the idempotency check.
 *   npm run db:counts
 * Kept as a script rather than a psql one-liner because the sandbox (and a reviewer's laptop)
 * may have Prisma but no postgres client tools.
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const [labs, providers, models, listings, benchmarks, scores, runs] = await Promise.all([
  p.lab.count(), p.provider.count(), p.model.count(), p.modelListing.count(),
  p.benchmark.count(), p.benchmarkScore.count(), p.ingestRun.count(),
]);
console.log({ labs, providers, models, listings, benchmarks, scores, ingestRuns: runs });

const spread = await p.$queryRaw`
  SELECT COUNT(*)::int AS models, ROUND(AVG(c), 2) AS avg_providers_per_model, MAX(c) AS max_providers
  FROM (SELECT COUNT(*)::int c FROM "ModelListing" GROUP BY "modelId") t`;
console.log(spread);

const last = await p.ingestRun.findFirst({ orderBy: { startedAt: 'desc' }, select: { source: true, status: true, modelsUp: true, listingsUp: true, skipped: true, startedAt: true } });
console.log('last run', last);
await p.$disconnect();
