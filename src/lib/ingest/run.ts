import { fetchCatalogue } from './openrouter';
import { normalise } from './normalise';
import { persistCatalogue } from './persist';
import { rawModelListSchema } from '../validation';

/**
 * One full catalogue mirror: fetch, validate, normalise, upsert. Shared by the two callers that
 * may start it (POST /api/admin/ingest by hand, GET /api/cron/ingest on a schedule) so there is
 * exactly one definition of "refresh the data", and the IngestRun row records who asked.
 * Endpoint enrichment is deliberately not part of this: it takes minutes, and a scheduled
 * function is the wrong place for it (README §Deploy); prices and specs are the part that moves.
 */
export async function mirrorCatalogue(source: string) {
  const started = Date.now();
  const models = rawModelListSchema.parse(await fetchCatalogue());
  const raw = Array.isArray(models) ? models : models.data;
  const result = normalise(raw);
  const written = await persistCatalogue(result, source);
  return { ...written, durationMs: Date.now() - started, issues: result.issues.length };
}
