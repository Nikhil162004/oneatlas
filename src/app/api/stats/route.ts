import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';

export const revalidate = 300;

/**
 * GET /api/stats — the hero counters and the capability-coverage bars. One grouped read, cached
 * hard for 5 minutes: these numbers move on the scale of hours, and a count over the whole table
 * on every page view is how an MVP turns into a slow page.
 */
export const GET = route(async function stats() {
  const [models, labs, providers, listings, types, coverage, benchmarkCoverage, latest] = await Promise.all([
    prisma.model.count(),
    prisma.lab.count(),
    prisma.provider.count(),
    prisma.modelListing.count(),
    prisma.model.groupBy({ by: ['modelType'], _count: { modelType: true } }),
    // COUNT(*) FILTER, not SUM(bool): Postgres has no boolean sum, and Prisma's _sum on a
    // boolean column fails at runtime rather than at build time.
    prisma.$queryRaw<Array<{ total: number; reasoning: number; tools: number; structured: number; vision: number; openWeights: number }>>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE "supportsReasoning")       AS reasoning,
             COUNT(*) FILTER (WHERE "supportsToolCalling")     AS tools,
             COUNT(*) FILTER (WHERE "supportsStructuredOutput") AS structured,
             COUNT(*) FILTER (WHERE "supportsVisionInput")     AS vision,
             COUNT(*) FILTER (WHERE "openWeights")             AS "openWeights"
      FROM "Model"`,
    prisma.$queryRaw<Array<{ name: string; count: number }>>`
      SELECT b.name, COUNT(s."modelId")::int AS count
      FROM "Benchmark" b LEFT JOIN "BenchmarkScore" s ON s."benchmarkId" = b.id
      GROUP BY b.id ORDER BY count DESC LIMIT 12`,
    prisma.model.findMany({ orderBy: { releaseDate: 'desc' }, take: 8, select: { slug: true, name: true, releaseDate: true, lab: { select: { name: true } } } }),
  ]);

  const [counts] = coverage;
  const total = Number(counts?.total) || 1;
  const pct = (n: number | bigint | null | undefined) => Math.round((Number(n ?? 0) / total) * 100);

  return ok({
    models,
    labs,
    providers,
    listings,
    byType: Object.fromEntries(types.map((t) => [t.modelType, t._count.modelType])),
    coverage: {
      reasoning: pct(counts?.reasoning),
      tools: pct(counts?.tools),
      structuredOutput: pct(counts?.structured),
      visionInput: pct(counts?.vision),
      openWeights: pct(counts?.openWeights),
    },
    benchmarks: benchmarkCoverage.map((b) => ({ name: b.name, scored: Number(b.count) })),
    latest,
  }, { cachedForSeconds: 300 });
});
