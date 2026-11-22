import Link from 'next/link';
import { listModels, listLabs, listProviders } from '@/lib/services/catalogue';
import { hrefWith, toSearchParams, type RawParams } from '@/lib/page';
import { listQuerySchema, parseQuery, CAPABILITIES, MODEL_TYPES, SORT_KEYS } from '@/lib/validation';
import { CapabilityTags, Empty, FilterBar, Notice, Pager } from '@/components/ui';
import { contextLabel, dateLabel, pricePair } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Models' };

// The query vocabulary, not the column names: `structured` is what a URL says for structured output.
const CHIP_LABEL: Record<string, string> = {
  reasoning: 'reasoning',
  tools: 'tool calling',
  structured: 'structured output',
  vision: 'vision input',
  openWeights: 'open weights',
};

/* The keys a URL uses to say what is in the table, with the words a person would use for them. The
   × on a chip deletes exactly this key, which is why the label is not the source of truth: the
   parameter is. */
const FILTER_FIELDS: Array<{ key: string; label: string; multi?: boolean }> = [
  { key: 'q', label: 'search' },
  { key: 'capabilities', label: 'capability', multi: true },
  { key: 'type', label: 'type' },
  { key: 'lab', label: 'lab' },
  { key: 'provider', label: 'provider' },
  { key: 'minContext', label: 'min context' },
  { key: 'maxPrice', label: 'max price' },
  { key: 'free', label: 'free tier only' },
  { key: 'hideDeprecated', label: 'hiding deprecated' },
];

const SORT_LABEL: Record<string, string> = {
  released: 'Released',
  context: 'Context',
  priceLow: 'Cheapest input',
  priceHigh: 'Dearest input',
  name: 'Name',
};

/**
 * The browse screen. Every control is a native field in one GET form, so the filtered view *is* a
 * URL: shareable, bookmarkable, back-button-correct, and the page stays a server component that
 * parses its own query with the same schema `GET /api/models` uses.
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

  // limit/sort/dir are how the table is arranged, not what is in it, so they are not filter chips.

  return (
    <div className="has-subbar space-y-6">
      <div>
        <h1>Models</h1>
        <p className="lede mt-2">
          Filter by capability, lab, price or context. The form writes the URL, and{" "}
          <span className="num text-[var(--fg)]">GET /api/models</span> reads the same parameters, so
          what you are looking at and what the API returns are one query.
        </p>
      </div>

      <form method="get" action="/models" className="card grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-4">
          <label className="block">
            <span className="label mb-1 block">Search</span>
            <input className="field w-full" type="text" name="q" defaultValue={query.q ?? ''} placeholder="claude, llama, whisper" enterKeyHint="search" autoComplete="off" />
          </label>
          <fieldset>
            <legend className="label mb-1 block">Capabilities</legend>
            <div className="flex flex-wrap gap-2">
              {CAPABILITIES.map((c) => (
                <label key={c} className="chip">
                  <input type="checkbox" name="capabilities" value={c} defaultChecked={query.capabilities?.includes(c)} />
                  {CHIP_LABEL[c]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="label mb-1 block">Lab</span>
            <input className="field w-full" list="labs" name="lab" defaultValue={query.lab ?? ''} placeholder="any" enterKeyHint="search" autoComplete="off" />
            <datalist id="labs">
              {labs.data.map((l) => <option key={l.slug} value={l.slug}>{`${l.name} ${l.modelCount}`}</option>)}
            </datalist>
          </label>
          <label className="block">
            <span className="label mb-1 block">Provider</span>
            <input className="field w-full" list="providers" name="provider" defaultValue={query.provider ?? ''} placeholder="any" enterKeyHint="search" autoComplete="off" />
            <datalist id="providers">
              {providers.data.map((pv) => <option key={pv.slug} value={pv.slug}>{`${pv.name} ${pv.modelCount}`}</option>)}
            </datalist>
          </label>
          <label className="block">
            <span className="label mb-1 block">Type</span>
            <select className="field w-full" name="type" defaultValue={query.type ?? ''}>
              <option value="">Any</option>
              {MODEL_TYPES.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="chip">
              <input type="checkbox" name="free" value="true" defaultChecked={query.free} /> free tier
            </label>
            <label className="chip">
              <input type="checkbox" name="hideDeprecated" value="true" defaultChecked={query.hideDeprecated} /> hide deprecated
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="label mb-1 block">Min context</span>
            <input className="field w-full num" type="text" inputMode="numeric" pattern="[0-9]*" name="minContext" defaultValue={query.minContext ?? ''} placeholder="128000" enterKeyHint="search" autoComplete="off" />
          </label>
          <label className="block">
            <span className="label mb-1 block">Max input price per 1M</span>
            <input className="field w-full num" type="text" inputMode="decimal" name="maxPrice" defaultValue={query.maxPrice ?? ''} placeholder="any" enterKeyHint="search" autoComplete="off" />
          </label>
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="label mb-1 block">Sort</span>
              <select className="field w-full" name="sort" defaultValue={query.sort}>
                {SORT_KEYS.map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" type="submit">Apply</button>
          </div>
        </div>
      </form>

      <FilterBar
        path="/models"
        raw={raw}
        count={meta.total === null ? `${data.length} shown` : `${meta.total} matching`}
        note={`sorted by ${SORT_LABEL[query.sort]}${query.dir === 'asc' ? ', ascending' : ''}`}
        fields={FILTER_FIELDS}
      />

      {!data.length ? (
        <Empty
          title="No model matches those filters"
          hint="Drop the context floor, remove a capability, or raise the price ceiling."
          action={{ href: '/models', label: 'Show everything' }}
        />
      ) : (
        <div className="tablewrap">
          <table className="stack-sm min-w-[1000px] text-sm">
            <caption className="sr-only">Models, filterable and sortable; each model name links to its detail page</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Capabilities</th>
                {([['context', 'Context'], ['priceLow', 'In / out per 1M'], ['released', 'Released']] as const).map(([key, label]) => {
                  const active = query.sort === key;
                  const dir = active && query.dir !== 'asc' ? 'asc' : 'desc';
                  return (
                    <th key={key} scope="col" className={key === 'context' || key === 'priceLow' ? 'text-right' : undefined} aria-sort={active ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <Link className="sortlink justify-end" href={hrefWith(raw, { sort: key, dir, cursor: null })} aria-sort={active ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        {label}
                        <span className="num text-[11px]" aria-hidden="true">{active ? (query.dir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}</span>
                      </Link>
                    </th>
                  );
                })}
                <th scope="col" className="text-right">Providers</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td data-title>
                    <Link className="rowlink font-medium" href={`/models/${m.slug}`}>{m.name}</Link>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--faint)]">
                      <span className="tag">{m.modelType.toLowerCase()}</span>
                      {m.lab.name}
                      {m.pricing.free && <span className="flag flag-quiet">free</span>}
                    </span>
                  </td>
                  <td data-label="Capabilities"><CapabilityTags caps={m.capabilities} /></td>
                  <td data-label="Context" className="num text-right">{contextLabel(m.contextWindow)}</td>
                  <td data-label="In / out per 1M" className="num text-right">{pricePair(m.pricing.per1M.prompt, m.pricing.per1M.completion)}</td>
                  <td data-label="Released" className="num text-right text-[var(--muted)]">{dateLabel(m.releaseDate)}</td>
                  <td data-label="Providers" className="num text-right">{m.providerCount || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        params={sp}
        meta={meta}
        pageHref={(cursor) => hrefWith(raw, { cursor })}
      />
    </div>
  );
}
