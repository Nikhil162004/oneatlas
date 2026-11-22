import { ok, route } from '@/lib/api';
import { prisma } from '@/lib/db';

// force-dynamic, not revalidate: the handler reads `limit` off the URL, so a statically prerendered
// copy would answer every query with the build-time default. Prisma is the cache layer here.
export const dynamic = 'force-dynamic';

/** GET /api/labs — module 5's directory: labs ranked by how much they ship, with price spread. */
export const GET = route(async function labs(request: Request) {
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') ?? 100) || 100, 1), 200);
  const data = await prisma.lab.findMany({
    take: limit,
    orderBy: [{ models: { _count: 'desc' } }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      website: true,
      summary: true,
      _count: { select: { models: true } },
    },
  });

  return ok(
    data.map((l) => ({ slug: l.slug, name: l.name, website: l.website, summary: l.summary, modelCount: l._count.models })),
    { limit, total: data.length },
  );
});
