/**
 * The one implementation of the hero numbers. The route handler and the home page both call this.
 *
 * It exists because the first version of `src/app/page.tsx` did `fetch('/api/stats')` from a server
 * component. A relative URL is not a valid fetch target in Node — the loopback call failed, the
 * catch swallowed it, and the page quietly rendered em dashes next to a database holding 476 rows.
 * Calling your own HTTP surface from the server buys a serialisation round trip and a failure mode
 * for no gain; the API stays for the browser, and server components take the data layer directly.
 */

import { prisma } from '../db';

export type Stats = {
  models: number;
  labs: number;
  providers: number;
  listings: number;
  byType: Record<string, number>;
  coverage: { reasoning: number; tools: number; structuredOutput: number; visionInput: number; openWeights: number };
  benchmarks: Array<{ name: string; scored: number }>;
  latest: Array<{ slug: string; name: string; releaseDate: Date | null; lab: { name: string } }>;
  /** When ingest last wrote. The footer states it, so a stale catalogue looks stale instead of trusted. */
  mirroredAt: Date | null;
};

export async function getStats(): Promise<Stats> {
  const [models, labs, providers, listings, types, coverage, benchmarkCoverage, latest, run] = await Promise.all([
    prisma.model.count(),
    prisma.lab.count(),
    prisma.provider.count(),
    prisma.modelListing.count(),
    prisma.model.groupBy({ by: ['modelType'], _count: { modelType: true } }),
    // COUNT(*) FILTER, not SUM(bool): Postgres has no boolean sum, and Prisma's _sum on a boolean
    // column fails at runtime rather than at build time.
    prisma.$queryRaw<Array<{ total: number; reasoning: number; tools: number; structured: number; vision: number; openWeights: number }>>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE "supportsReasoning")        AS reasoning,
             COUNT(*) FILTER (WHERE "supportsToolCalling")      AS tools,
             COUNT(*) FILTER (WHERE "supportsStructuredOutput") AS structured,
             COUNT(*) FILTER (WHERE "supportsVisionInput")      AS vision,
             COUNT(*) FILTER (WHERE "openWeights")              AS "openWeights"
      FROM "Model"`,
    prisma.$queryRaw<Array<{ name: string; count: number }>>`
      SELECT b.name, COUNT(s."modelId")::int AS count
      FROM "Benchmark" b LEFT JOIN "BenchmarkScore" s ON s."benchmarkId" = b.id
      GROUP BY b.id ORDER BY count DESC LIMIT 12`,
    prisma.model.findMany({ orderBy: { releaseDate: 'desc' }, take: 8, select: { slug: true, name: true, releaseDate: true, lab: { select: { name: true } } } }),
    // finishedAt is null on a run that died mid-flight, so fall back to when it started.
    prisma.ingestRun.findFirst({ orderBy: { startedAt: 'desc' }, select: { startedAt: true, finishedAt: true, status: true } }),
  ]);

  const [counts] = coverage;
  const total = Number(counts?.total) || 1;
  const pct = (n: number | bigint | null | undefined) => Math.round((Number(n ?? 0) / total) * 100);

  return {
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
    mirroredAt: run ? (run.finishedAt ?? run.startedAt) : null,
    benchmarks: benchmarkCoverage.map((b) => ({ name: b.name, scored: Number(b.count) })),
    latest,
  };
}
