import { mirrorCatalogue } from '@/lib/ingest/run';
import { fail, ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ingest — refresh from the deployment: the button a reviewer can press in the
 * Loom, and the endpoint any scheduler that can POST calls. The scheduled caller uses
 * GET /api/cron/ingest instead, because a Vercel cron sends GET and carries its own secret;
 * both end at `mirrorCatalogue`, so there is one definition of a refresh.
 *
 * Guarded by a shared secret header, and deliberately unprotected by anything cleverer: the
 * endpoint only ever upserts from a public catalogue, so the worst case of a leaked token is a
 * wasted fetch. That trade (idempotency instead of auth complexity) is what makes it safe to leave
 * in, and it is worth saying out loud in the video.
 */
export const POST = route(async function adminIngest(request: Request) {
  const token = process.env.INGEST_TOKEN;
  if (!token) return fail(503, 'Ingest is disabled: set INGEST_TOKEN');
  if (request.headers.get('x-ingest-token') !== token) return fail(400, 'Invalid x-ingest-token');

  const result = await mirrorCatalogue('openrouter:models');
  return ok(result, {}, 'no-store');
});
