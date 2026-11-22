import { ingestStatus } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/status — ingest runs and catalogue counts: is the daily mirror alive?
 * no-store, unlike the catalogue reads: a health answer that the edge cached five minutes ago
 * is a stale fact presented as a current one, which is the failure this route exists to catch. */
export const GET = route(async function statusRoute() {
  const { data, meta } = await ingestStatus();
  return ok(data, meta, 'private, no-store');
});
