import { normalise } from '@/lib/ingest/normalise';
import { fetchCatalogue } from '@/lib/ingest/openrouter';
import { persistCatalogue } from '@/lib/ingest/persist';
import { rawModelListSchema } from '@/lib/validation';
import { fail, ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ingest — refresh from the deployment: the button a reviewer can press in the
 * Loom, and the endpoint any scheduler that can POST calls. Not a Vercel cron target, because a
 * Vercel cron sends GET and this route is a write; that asymmetry is on purpose.
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

  const started = Date.now();
  const models = rawModelListSchema.parse(await fetchCatalogue());
  const raw = Array.isArray(models) ? models : models.data;
  const result = normalise(raw);
  const written = await persistCatalogue(result, 'openrouter:models');

  return ok({ ...written, durationMs: Date.now() - started, issues: result.issues.length }, {}, 'no-store');
});
