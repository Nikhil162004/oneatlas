/**
 * Ingest CLI. Examples:
 *   tsx scripts/ingest.ts --dry                      fetch, normalise, print counts, touch nothing
 *   tsx scripts/ingest.ts                            fetch and write to DATABASE_URL
 *   tsx scripts/ingest.ts --offline or.json --dry    replay a saved payload (no network)
 *   tsx scripts/ingest.ts --limit 40 --endpoints     enrich 40 models with per-provider listings
 */

import { normalise, type RawEndpoint, type RawModel } from '../src/lib/ingest/normalise';
import { fetchCatalogue, fetchEndpoints, mapWithConcurrency, readJsonFile } from '../src/lib/ingest/openrouter';
import { rawModelListSchema } from '../src/lib/validation';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const source = flag('offline') ? `file:${arg('offline')}` : 'openrouter:models';
  const json = flag('offline') ? await readJsonFile(arg('offline')!) : await fetchCatalogue();
  const models = rawModelListSchema.parse(json);
  const raw: RawModel[] = Array.isArray(models) ? models : models.data;

  const limit = Number(arg('limit') ?? 0);
  const scoped = limit > 0 ? raw.slice(0, limit) : raw;

  const endpoints = new Map<string, RawEndpoint[]>();
  if (flag('endpoints')) {
    console.log(`enriching ${scoped.length} models with per-provider listings (concurrency ${arg('concurrency') ?? 4})`);
    const found = await mapWithConcurrency(scoped, Number(arg('concurrency') ?? 4), fetchEndpoints);
    for (const f of found) if (f?.endpoints?.length) endpoints.set(f.modelId, f.endpoints);
  }

  const result = normalise(scoped, endpoints);
  const byType = result.models.reduce<Record<string, number>>((acc, m) => ((acc[m.modelType] = (acc[m.modelType] ?? 0) + 1), acc), {});

  console.log(`source      ${source}`);
  console.log(`records in  ${scoped.length}`);
  console.log(`models      ${result.models.length}`);
  console.log(`labs        ${result.labs.size}   providers ${result.providers.size}`);
  console.log(`listings    ${result.listings.length}`);
  console.log(`benchmarks  ${result.benchmarks.size} across ${result.scores.length} scores`);
  console.log(`by type     ${JSON.stringify(byType)}`);
  console.log(`issues      ${result.issues.length}`);
  for (const i of result.issues.slice(0, 10)) console.log(`  ! ${i.modelId}: ${i.field} — ${i.message}`);

  if (flag('dry')) {
    console.log('\n--dry: nothing written');
    return;
  }

  const { persistCatalogue } = await import('../src/lib/ingest/persist');
  const written = await persistCatalogue(result, source);
  console.log(`\nwrote       models ${written.modelsUp}  listings ${written.listingsUp}  scores ${written.scoresUp}  skipped ${written.skipped}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  // Prisma answers a missing env var with a validation dump and code frames. The one thing the
  // reader needs is the fix, so check for it before anything touches the database.
  if (/Environment variable not found: DATABASE_URL|P1012/.test(message)) {
    console.error('ingest failed: DATABASE_URL is not set. Run `cp .env.example .env` and point it at Postgres.');
    process.exit(1);
  }
  console.error('ingest failed:', message.split('\n').filter((l) => l.trim()).slice(0, 6).join('\n  '));
  process.exit(1);
});
