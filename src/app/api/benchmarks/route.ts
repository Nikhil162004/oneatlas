import { listBenchmarks } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/benchmarks — every benchmark, its scored-model count and current top model. */
export const GET = route(async function benchmarksRoute() {
  const { data, meta } = await listBenchmarks();
  return ok(data, meta);
});
