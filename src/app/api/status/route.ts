import { ingestStatus } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/status — ingest runs and catalogue counts: is the daily mirror alive? */
export const GET = route(async function statusRoute() {
  const { data, meta } = await ingestStatus();
  return ok(data, meta);
});
