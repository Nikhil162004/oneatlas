import { providerDetail } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/providers/{slug} — one provider, the models it serves, its own cheapest price on each. */
export const GET = route(async function providerRoute(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = await providerDetail(slug);
  if (!provider) return Response.json({ data: null, error: { code: 'not_found', message: `No provider ${slug}` } }, { status: 404 });
  return ok(provider);
});
