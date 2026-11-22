import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/labs/{slug} — the lab page: their models, and the release cadence the brief asks for.
 * Releases are derived by grouping models on releaseDate; there is no Release table, because a
 * model row already *is* a release (docs/decisions/0004).
 */
export const GET = route(async function lab(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = await prisma.lab.findUnique({
    where: { slug: slug.toLowerCase() },
    include: {
      models: {
        orderBy: { releaseDate: 'desc' },
        select: {
          slug: true, name: true, modelType: true, contextWindow: true, releaseDate: true, deprecatedAt: true,
          openWeights: true, supportsReasoning: true, supportsToolCalling: true,
          listings: { take: 1, orderBy: { promptPer1M: 'asc' }, select: { promptPer1M: true, completionPer1M: true, provider: { select: { name: true } } } },
        },
      },
    },
  });
  if (!lab) return Response.json({ data: null, error: { code: 'not_found', message: `No lab ${slug}` } }, { status: 404 });

  const releases = new Map<string, number>();
  for (const m of lab.models) {
    if (!m.releaseDate) continue;
    const key = m.releaseDate.toISOString().slice(0, 7);
    releases.set(key, (releases.get(key) ?? 0) + 1);
  }

  return ok({
    slug: lab.slug,
    name: lab.name,
    website: lab.website,
    summary: lab.summary,
    modelCount: lab.models.length,
    models: lab.models.map((m) => ({
      slug: m.slug,
      name: m.name,
      modelType: m.modelType,
      contextWindow: m.contextWindow,
      releaseDate: m.releaseDate,
      deprecated: Boolean(m.deprecatedAt),
      openWeights: m.openWeights,
      cheapestPer1M: m.listings[0]?.promptPer1M ? Number(m.listings[0].promptPer1M) : null,
      cheapestProvider: m.listings[0]?.provider.name ?? null,
    })),
    releases: [...releases.entries()].map(([month, count]) => ({ month, count })).sort((a, b) => b.month.localeCompare(a.month)),
  });
});
