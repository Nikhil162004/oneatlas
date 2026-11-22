import { modelsBySlugs } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/models/watchlist?ids=a,b — live rows for a reader's watched slugs (see /watchlist). */
export const GET = route(async function watchlistRoute(request: Request) {
  const sp = new URL(request.url).searchParams;
  const ids = sp
    .getAll('ids')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
  const { data, meta } = await modelsBySlugs(ids);
  return ok(data, meta);
});
