import { releaseTimeline } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/releases — every dated release grouped by month, newest first. */
export const GET = route(async function releasesRoute() {
  const { data, meta } = await releaseTimeline();
  return ok(data, meta);
});
