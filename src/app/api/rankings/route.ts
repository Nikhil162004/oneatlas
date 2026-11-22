import { buildRanking } from '@/lib/query';
import { parseQuery, rankingQuerySchema } from '@/lib/validation';
import { badRequest, ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rankings — module 4. Leaderboard rows for one benchmark, filtered by category and
 * model type. Offset paging, not cursor: a leaderboard is read by position, and jumping to rank
 * 40 has to stay possible.
 */
export const GET = route(async function rankings(request: Request) {
  const url = new URL(request.url);
  const parsed = parseQuery(rankingQuerySchema, url.searchParams);
  if (!parsed.ok) return badRequest(parsed.fields);

  const { text, values } = buildRanking(parsed.data);
  const rows = (await prisma.$queryRawUnsafe(text, ...values)) as Array<Record<string, unknown>>;

  const benchmarks = await prisma.benchmark.findMany({
    select: { slug: true, name: true, category: true, unit: true, _count: { select: { scores: true } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return ok(
    rows.map((r, i) => ({
      rank: parsed.data.offset + i + 1,
      benchmark: { slug: r.benchmarkSlug, name: r.benchmarkName, category: r.category },
      score: Number(r.score),
      model: { id: r.id, slug: r.slug, name: r.name, modelType: r.modelType, contextWindow: r.contextWindow, lab: { slug: r.labSlug, name: r.labName } },
      cheapestPromptPer1M: r.minPrompt === null ? null : Number(r.minPrompt),
    })),
    { total: Number(rows[0]?.total ?? 0), limit: parsed.data.limit, offset: parsed.data.offset, benchmarks },
  );
});
