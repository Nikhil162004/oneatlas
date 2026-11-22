import { globalSearch } from '@/lib/services/catalogue';
import { badRequest, ok, route } from '@/lib/api';
import { globalSearchSchema, parseQuery } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/search?q= — module 6's global lookup across models, labs and providers. */
export const GET = route(async function search(request: Request) {
  const parsed = parseQuery(globalSearchSchema, new URL(request.url).searchParams);
  if (!parsed.ok) return badRequest(parsed.fields, 'q is required');
  const { data, meta } = await globalSearch(parsed.data.q, parsed.data.perGroup);
  return ok(data, meta);
});
