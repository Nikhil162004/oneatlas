import { modelDetail } from '@/lib/services/catalogue';
import { badRequest, ok, route } from '@/lib/api';
import { slugParamSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/models/{lab}/{slug} — module 2. URL shape matches the live product, so a pasted link
 * reads as the same site.
 */
export const GET = route(async function modelDetailRoute(
  _request: Request,
  { params }: { params: Promise<{ lab: string; slug: string }> },
) {
  const parsed = slugParamSchema.safeParse(await params);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors, 'Invalid lab or slug');
  const model = await modelDetail(parsed.data.lab, parsed.data.slug);
  if (!model) {
    return Response.json({ data: null, error: { code: 'not_found', message: `No model ${parsed.data.lab}/${parsed.data.slug}` } }, { status: 404 });
  }
  return ok(model, { etagSource: model.updatedAt.toISOString() });
});
