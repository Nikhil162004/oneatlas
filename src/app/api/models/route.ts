import { listModels } from '@/lib/services/catalogue';
import { badRequest, ok, route } from '@/lib/api';
import { parseQuery, listQuerySchema } from '@/lib/validation';

export const dynamic = 'force-dynamic'; // filters live in the URL; caching a stale page beats caching none

/**
 * GET /api/models — module 1: search, filter, sort, paginate.
 * The page at /models calls the same service, so a row seen in the browser and a row seen by an
 * API client are produced by one piece of code.
 */
export const GET = route(async function modelsList(request: Request) {
  const parsed = parseQuery(listQuerySchema, new URL(request.url).searchParams);
  if (!parsed.ok) return badRequest(parsed.fields);
  const { data, meta } = await listModels(parsed.data);
  return ok(data, meta);
});
