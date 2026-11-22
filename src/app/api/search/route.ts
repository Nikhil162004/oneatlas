import { prisma } from '@/lib/db';
import { badRequest, ok, route } from '@/lib/api';
import { likeTerm } from '@/lib/query';
import { globalSearchSchema, parseQuery } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search?q= — module 6's global search: models, labs and providers in one round trip.
 * Three small bounded ILIKE queries rather than one UNION: different tables, different result
 * shapes, and the UI renders them as groups anyway. perGroup keeps a typo from pulling 400 rows.
 */
export const GET = route(async function search(request: Request) {
  const url = new URL(request.url);
  const parsed = parseQuery(globalSearchSchema, url.searchParams);
  if (!parsed.ok) return badRequest(parsed.fields, 'q is required');
  const { q, perGroup } = parsed.data;
  const term = likeTerm(q);
  const like = { mode: 'insensitive' as const };

  const [models, labs, providers] = await Promise.all([
    prisma.model.findMany({ where: { OR: [{ name: { contains: term, ...like } }, { slug: { contains: term, ...like } }] }, take: perGroup, select: { slug: true, name: true, modelType: true, lab: { select: { name: true } } } }),
    prisma.lab.findMany({ where: { OR: [{ name: { contains: term, ...like } }, { slug: { contains: term, ...like } }] }, take: perGroup, select: { slug: true, name: true, _count: { select: { models: true } } } }),
    prisma.provider.findMany({ where: { OR: [{ name: { contains: term, ...like } }, { slug: { contains: term, ...like } }] }, take: perGroup, select: { slug: true, name: true, _count: { select: { listings: true } } } }),
  ]);

  return ok(
    {
      models: models.map((m) => ({ type: 'model' as const, ...m })),
      labs: labs.map((l) => ({ type: 'lab' as const, ...l, modelCount: l._count.models })),
      providers: providers.map((p) => ({ type: 'provider' as const, ...p, listingCount: p._count.listings })),
    },
    { query: q, empty: models.length + labs.length + providers.length === 0 },
  );
});
