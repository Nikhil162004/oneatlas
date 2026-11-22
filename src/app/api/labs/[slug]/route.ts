import { labDetail } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/labs/{slug} — models plus the derived release cadence (no Release table; decisions/0004). */
export const GET = route(async function labRoute(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = await labDetail(slug);
  if (!lab) return Response.json({ data: null, error: { code: 'not_found', message: `No lab ${slug}` } }, { status: 404 });
  return ok(lab);
});
