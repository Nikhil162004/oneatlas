import { listCollections } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/collections — the guided-discovery sets, computed from live rows. */
export const GET = route(async function collectionsRoute() {
  const { data, meta } = await listCollections();
  return ok(data, meta);
});
