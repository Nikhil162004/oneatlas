import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';

// force-dynamic, not revalidate: the handler reads `limit` off the URL, so a statically prerendered
// copy would answer every query with the build-time default. Prisma is the cache layer here.
export const dynamic = 'force-dynamic';

/** GET /api/providers — the other half of module 5: who serves what, at what spread. */
export const GET = route(async function providers(request: Request) {
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') ?? 100) || 100, 1), 200);
  const rows = await prisma.provider.findMany({
    take: limit,
    orderBy: [{ listings: { _count: 'desc' } }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      website: true,
      listings: { select: { modelId: true, promptPer1M: true, isFree: true, uptimePct: true, latencyP50Ms: true } },
    },
  });

  return ok(
    rows.map((p) => {
      const prices = p.listings.map((l) => Number(l.promptPer1M)).filter(Number.isFinite);
      const latencies = p.listings.map((l) => l.latencyP50Ms).filter((v): v is number => v !== null);
      const uptimes = p.listings.map((l) => Number(l.uptimePct)).filter(Number.isFinite);
      const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1e4) / 1e4 : null);
      return {
        slug: p.slug,
        name: p.name,
        website: p.website,
        modelCount: new Set(p.listings.map((l) => l.modelId)).size,
        listingCount: p.listings.length,
        freeCount: p.listings.filter((l) => l.isFree).length,
        cheapestPromptPer1M: prices.length ? Math.min(...prices) : null,
        avgPromptPer1M: avg(prices),
        avgLatencyMs: avg(latencies),
        avgUptimePct: avg(uptimes),
      };
    }),
    { limit },
  );
});
