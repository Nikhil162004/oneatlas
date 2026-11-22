import Link from 'next/link';
import { listModels, listLabs, listProviders } from '@/lib/services/catalogue';
import { toSearchParams, type RawParams } from '@/lib/page';
import { listQuerySchema, parseQuery, CAPABILITIES, MODEL_TYPES, SORT_KEYS } from '@/lib/validation';
import { Notice } from '@/components/ui';
import ModelsExplorer from '@/components/ModelsExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Models' };

/**
 * The browse screen. Server-rendered for the first paint, then a client island
 * (docs/decisions/0008): the filter form, chips, sort headers and pager fetch `GET /api/models`
 * and replace only the table, while the URL stays the state through pushState. The query still
 * goes through the same schema the API uses, so a view and its JSON cannot drift apart.
 */
export default async function ModelsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const sp = toSearchParams(raw);
  const parsed = parseQuery(listQuerySchema, sp);
  if (!parsed.ok) {
    return (
      <div className="space-y-4">
        <h1>Models</h1>
        <Notice>
          Those filters were rejected: {Object.keys(parsed.fields).join(', ')}.{' '}
          <Link className="underline" href="/models">Start over</Link>.
        </Notice>
      </div>
    );
  }

  const query = parsed.data;
  // A database that is down or not yet seeded renders an empty table with an explanation, not a 500.
  const [{ data, meta }, labs, providers] = await Promise.all([
    listModels(query).catch(() => ({ data: [], meta: { total: null, limit: query.limit, sort: query.sort, dir: undefined, nextCursor: null } })),
    listLabs(200).catch(() => ({ data: [] })),
    // Only providers with a mirrored endpoint can serve anything, so those are the only ones worth
    // offering as a filter; listProviders already excludes catalogue-only listings.
    listProviders(200).then((r) => ({ data: r.data })).catch(() => ({ data: [] })),
  ]);

  return (
    <div className="has-subbar space-y-6">
      <div>
        <h1>Models</h1>
        <p className="lede mt-2">
          Filter by capability, lab, price or context. Applying a filter updates the table in
          place and writes the URL, and{" "}
          <span className="num text-[var(--fg)]">GET /api/models</span> reads the same parameters,
          so what you are looking at and what the API returns are one query.
        </p>
      </div>

      <ModelsExplorer
        key={sp.toString()}
        initialData={data}
        initialMeta={meta}
        labs={labs.data}
        providers={providers.data}
        initialSearch={sp.toString()}
        capabilities={CAPABILITIES}
        modelTypes={MODEL_TYPES}
        sortKeys={SORT_KEYS}
      />
    </div>
  );
}
