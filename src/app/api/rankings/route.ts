import { rankings } from '@/lib/services/catalogue';
import { badRequest, ok, route } from '@/lib/api';
import { parseQuery, rankingQuerySchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/rankings — module 4. Offset paging on purpose: a leaderboard is read by position. */
export const GET = route(async function rankingsRoute(request: Request) {
  const parsed = parseQuery(rankingQuerySchema, new URL(request.url).searchParams);
  if (!parsed.ok) return badRequest(parsed.fields);
  const { data, meta } = await rankings(parsed.data);
  return ok(data, meta);
});
