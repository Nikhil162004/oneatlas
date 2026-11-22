import { benchmarkMatrix } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/benchmarks/matrix — most-scored models × most-populated benchmarks, best per column flagged. */
export const GET = route(async function matrixRoute() {
  const { data, meta } = await benchmarkMatrix();
  return ok(data, meta);
});
