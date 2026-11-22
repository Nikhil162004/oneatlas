import { prisma } from '@/lib/db';
import { badRequest, ok, route } from '@/lib/api';
import { compareSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/models/compare?ids=a/b,c/d
 *
 * GET with ids in the URL, not POST with a body: the comparison must survive a paste into Slack
 * and a browser refresh, which is the whole point of a compare screen. The 2..6 bound is in
 * `compareSchema`, so the UI never has to defend it twice.
 */
export const GET = route(async function compare(request: Request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const parsed = compareSchema.safeParse({ modelIds: raw });
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors, 'ids= must list 2-6 model slugs');

  const models = await prisma.model.findMany({
    where: { slug: { in: parsed.data.modelIds.map((s) => s.toLowerCase()) } },
    include: {
      lab: { select: { slug: true, name: true } },
      listings: { include: { provider: { select: { slug: true, name: true } } }, orderBy: { promptPer1M: 'asc' } },
      scores: { include: { benchmark: { select: { slug: true, name: true, category: true } } } },
    },
    orderBy: { releaseDate: 'desc' },
  });

  const bySlug = new Map(models.map((m) => [m.slug, m]));
  const money = (v: { toString(): string } | null) => (v === null ? null : Number(String(v)));

  return ok(
    {
      // `selected` keeps the caller's order and marks what was missing, so the page can show
      // "2 of 3 loaded" instead of silently shrinking the table.
      selected: parsed.data.modelIds.map((slug) => ({ slug, found: bySlug.has(slug.toLowerCase()) })),
      rows: models.map((m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        lab: m.lab,
        modelType: m.modelType,
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
        capabilities: {
          reasoning: m.supportsReasoning,
          tools: m.supportsToolCalling,
          structuredOutput: m.supportsStructuredOutput,
          visionInput: m.supportsVisionInput,
          openWeights: m.openWeights,
        },
        releaseDate: m.releaseDate,
        providers: m.listings.map((l) => ({ provider: l.provider.name, free: l.isFree, per1M: { prompt: money(l.promptPer1M), completion: money(l.completionPer1M) } })),
        cheapest: { prompt: money(m.listings[0]?.promptPer1M ?? null), completion: money(m.listings[0]?.completionPer1M ?? null) },
        benchmarks: Object.fromEntries(m.scores.map((s) => [s.benchmark.slug, Number(s.score)])),
      })),
    },
    { count: models.length, requested: parsed.data.modelIds.length },
  );
});
