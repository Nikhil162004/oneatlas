import { listLabs } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic'; // reads ?limit=, so a statically prerendered copy would be wrong

/** GET /api/labs — module 5's directory, also what fills the lab filter on /models. */
export const GET = route(async function labsRoute(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 100) || 100;
  const { data, meta } = await listLabs(limit);
  return ok(data, meta);
});
