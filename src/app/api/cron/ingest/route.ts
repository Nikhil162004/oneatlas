import { mirrorCatalogue } from '@/lib/ingest/run';
import { fail, ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';
// A cold catalogue mirror is a fetch plus ~500 upserts: give it the platform's room rather than
// discovering the default ceiling in production at 03:00.
export const maxDuration = 300;

/**
 * GET /api/cron/ingest — the scheduled mirror (vercel.json `crons`, daily). Vercel cron sends a
 * GET with `Authorization: Bearer $CRON_SECRET` when that env var exists, which is why this is a
 * separate route from POST /api/admin/ingest rather than a second method on it: two callers, two
 * credentials, and either can be revoked without touching the other. Catalogue pass only;
 * endpoint enrichment stays a shell command (it takes minutes, not a function's lifetime).
 */
export const GET = route(async function cronIngest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail(503, 'Cron ingest is disabled: set CRON_SECRET');
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ data: null, error: { code: 'unauthorized', message: 'Invalid cron secret' } }, { status: 401 });
  }
  const result = await mirrorCatalogue('openrouter:cron');
  return ok(result, {}, 'no-store');
});
