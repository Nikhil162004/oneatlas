import { collectionDetail } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/collections/{slug} — one collection, ranked, with the reason each row earned its place. */
export const GET = route(async function collectionRoute(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await collectionDetail(slug);
  if (!collection) return Response.json({ data: null, error: { code: 'not_found', message: `No collection ${slug}` } }, { status: 404 });
  return ok(collection);
});
