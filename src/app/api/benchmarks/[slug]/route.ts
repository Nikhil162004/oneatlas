import { benchmarkDetail } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/benchmarks/{slug} — one benchmark and every scored model, in its own direction. */
export const GET = route(async function benchmarkRoute(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const benchmark = await benchmarkDetail(slug);
  if (!benchmark) return Response.json({ data: null, error: { code: 'not_found', message: `No benchmark ${slug}` } }, { status: 404 });
  return ok(benchmark);
});
