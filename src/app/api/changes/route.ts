import { changesFeed } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/changes — what the mirrors moved: prices, specs, capabilities, deprecations. */
export const GET = route(async function changesRoute(request: Request) {
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 50));
  const { data, meta } = await changesFeed(limit);
  return ok(data, meta);
});
