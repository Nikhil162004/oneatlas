import { compareModels } from '@/lib/services/catalogue';
import { badRequest, ok, route } from '@/lib/api';
import { compareSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/models/compare?ids=a/b,c/d
 *
 * GET with ids in the URL, not POST with a body: the comparison has to survive a paste into Slack
 * and a browser refresh, which is the whole point of a compare screen. The 2..6 bound lives in
 * `compareSchema`, so the page and the API cannot disagree about it.
 */
export const GET = route(async function compare(request: Request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const parsed = compareSchema.safeParse({ modelIds: raw });
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors, 'ids= must list 2-6 model slugs');
  const data = await compareModels(parsed.data.modelIds);
  return ok(data, { count: data.rows.length, requested: parsed.data.modelIds.length });
});
