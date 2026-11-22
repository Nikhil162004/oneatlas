import { ok, route } from '@/lib/api';
import { getStats } from '@/lib/services/stats';

export const revalidate = 300;

/**
 * GET /api/stats — the hero counters and the capability-coverage bars. Cached hard for 5 minutes:
 * these numbers move on the scale of hours, and a count over the whole table on every page view is
 * how an MVP turns into a slow page. The logic lives in lib/services so the server component uses
 * the same code without paying for a loopback request.
 */
export const GET = route(async function stats() {
  return ok(await getStats(), { cachedForSeconds: 300 });
});
