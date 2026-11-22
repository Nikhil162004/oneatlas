import { similarModels } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/models/{lab}/{slug}/alternatives — same type, shared capabilities, cheapest first. */
export const GET = route(async function alternativesRoute(_request: Request, { params }: { params: Promise<{ lab: string; slug: string }> }) {
  const { lab, slug } = await params;
  const result = await similarModels(lab, slug);
  if (!result) return Response.json({ data: null, error: { code: 'not_found', message: `No model ${lab}/${slug}` } }, { status: 404 });
  return ok(result.data, { target: result.target, count: result.data.length });
});
