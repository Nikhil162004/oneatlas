/**
 * Upstream catalogue client. Two public endpoints, plain fetch, no key, no scraper:
 *
 *   GET /api/v1/models                       the whole catalogue, one request
 *   GET /api/v1/models/{author}/{slug}/endpoints   per-provider listings, one request per model
 *
 * The second call is opt-in (`--endpoints`) because it is N+1 requests: 476 models is a slow
 * afternoon of politeness for data the product only needs on the detail page. Enrich those
 * lazily instead of crawling everything.
 */

import { rawEndpointListSchema, rawModelListSchema } from '../validation';
import type { RawEndpoint, RawModel } from './normalise';

const BASE = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';

/** A ZodError's .message is a pretty-printed array; one line per bad field is readable in a log. */
export function shortError(err: unknown): string {
  const issues = (err as { issues?: Array<{ path: (string | number)[]; message: string }> })?.issues;
  if (issues?.length) return issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return err instanceof Error ? err.message : String(err);
}

async function getJson(url: string, timeoutMs = 30_000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'oneatlas-ingest/0.1 (+research)' },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 60 * 60 }, // Node 20 fetch cache hint; harmless elsewhere
  } as RequestInit);
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}

export async function fetchCatalogue(): Promise<RawModel[]> {
  const json = await getJson(`${BASE}/models`);
  const parsed = rawModelListSchema.parse(json);
  return Array.isArray(parsed) ? parsed : parsed.data;
}

/** Best-effort per model: one failed lookup skips that model's enrichment, it never aborts a run. */
export async function fetchEndpoints(model: RawModel): Promise<{ modelId: string; endpoints: RawEndpoint[] } | null> {
  const slash = model.id.indexOf('/');
  if (slash < 0) return null;
  const url = `${BASE}/models/${encodeURIComponent(model.id.slice(0, slash))}/${encodeURIComponent(model.id.slice(slash + 1))}/endpoints`;
  try {
    const parsed = rawEndpointListSchema.parse(await getJson(url, 15_000));
    return { modelId: model.id, endpoints: (parsed.data?.endpoints ?? []) as RawEndpoint[] };
  } catch (err) {
    console.warn(`  ! endpoints skipped for ${model.id}: ${shortError(err)}`);
    return null;
  }
}

/** Small fixed-size pool. A queue or worker thread for 500 GETs is the wrong shape of tool. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Offline path for tests and for a reviewer without network: read a saved payload. */
export async function readJsonFile(path: string): Promise<unknown> {
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(path, 'utf8'));
}
