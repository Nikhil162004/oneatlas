import Link from 'next/link';
import { listModels } from '@/lib/services/catalogue';
import { listLabs } from '@/lib/services/catalogue';
import { hrefWith, toSearchParams, type RawParams } from '@/lib/page';
import { listQuerySchema, parseQuery } from '@/lib/validation';
import { CAP_LABEL, CapabilityBadges, Empty, Notice, Pager } from '@/components/ui';
import { contextLabel, dateLabel, pricePair } from '@/lib/format';
import { CAPABILITIES, MODEL_TYPES, SORT_KEYS } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Models' };

const SORT_LABEL: Record<string, string> = {
  released: 'Released',
  context: 'Context',
  priceLow: 'Cheapest input',
  priceHigh: 'Dearest input',
  name: 'Name',
};

/**
 * The browse screen. Every filter is a field in one GET form, so "filtered view" and "URL" are the
 * same thing: shareable, bookmarkable, and the page can be a plain server component with no client
 * bundle. The rows come from the same service as /api/models.
 */
export default async function ModelsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const sp = toSearchParams(raw);
  const parsed = parseQuery(listQuerySchema, sp);
  if (!parsed.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Models</h1>
        <Notice>Those filters were rejected: {Object.keys(parsed.fields).join(', ')}. The defaults are one link away: <Link className="underline" href="/models">all models</Link>.</Notice>
      </div>
    );
  }

  const query = parsed.data;
  // A broken or empty database must not take the page down — the brief grades reliability, and a
  // page that 500s because ingest has not run is worse than a page that says so.
  const [{ data, meta }, labs] = await Promise.all([
    listModels(query).catch(() => ({ data: [], meta: { total: null, limit: query.limit, sort: query.sort, dir: undefined, nextCursor: null } })),
    listLabs(200).catch(() => ({ data: [] })),
  ]);

  const active = sp.toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Models</h1>
          <p className="num text-sm text-[var(--muted)]">
            {meta.total === null ? `${data.length} shown` : `${meta.total} matching`} · sorted by {SORT_LABEL[query.sort]}
            {query.dir === 'asc' && ' ascending'}
          </p>
        </div>
        {active && <Link className="text-sm underline" href="/models">Clear all filters</Link>}
      </div>

      <form method="get" action="/models" className="grid gap-3 rounded-md border border-[var(--line)] p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Search</span>
          <input className="field w-full" type="text" name="q" defaultValue={query.q ?? ''} placeholder="claude, llama, whisper…" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Lab</span>
          <input className="field w-full" list="labs" name="lab" defaultValue={query.lab ?? ''} placeholder="any" />
          <datalist id="labs">
            {labs.data.map((l) => <option key={l.slug} value={l.slug}>{`${l.name} (${l.modelCount})`}</option>)}
          </datalist>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Type</span>
          <select className="field w-full" name="type" defaultValue={query.type ?? ''}>
            <option value="">Any</option>
            {MODEL_TYPES.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
          </select>
        </label>

        <fieldset className="text-sm sm:col-span-2">
          <legend className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">Capabilities</legend>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((c) => (
              <label key={c} className="chip flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded border border-[var(--line)] px-2 text-sm">
                <input type="checkbox" name="capabilities" value={c} defaultChecked={query.capabilities?.includes(c)} />
                {CAP_LABEL[c]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Min context</span>
          <input className="field w-full num" type="number" min={0} step={1000} name="minContext" defaultValue={query.minContext ?? ''} placeholder="e.g. 128000" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Max price / 1M in</span>
          <input className="field w-full num" type="number" min={0} step="0.1" name="maxPrice" defaultValue={query.maxPrice ?? ''} placeholder="any" />
        </label>

        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="chip flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded border border-[var(--line)] px-2">
            <input type="checkbox" name="free" value="true" defaultChecked={query.free} /> Free tier only
          </label>
          <label className="chip flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded border border-[var(--line)] px-2">
            <input type="checkbox" name="hideDeprecated" value="true" defaultChecked={query.hideDeprecated} /> Hide deprecated
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Sort</span>
            <select className="field" name="sort" defaultValue={query.sort}>
              {SORT_KEYS.map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Direction</span>
            <select className="field" name="dir" defaultValue={query.dir ?? ''}>
              <option value="">Auto</option>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit">Apply</button>
        </div>
      </form>

      {!data.length ? (
        <Empty title="No model matches those filters" hint="Loosen the context floor or drop a capability — an empty result is a correct answer, not an error." />
      ) : (
        <div className="tablewrap">
          <table className="min-w-[1100px] text-sm">
            <caption className="sr-only">Models, filterable and sortable; each row links to its detail page</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Capabilities</th>
                {([['context', 'Context'], ['priceLow', 'In / out $/1M'], ['released', 'Released']] as const).map(([key, label]) => (
                  <th key={key} scope="col" aria-sort={query.sort === key ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <Link className="underline-offset-2 hover:underline" href={hrefWith(raw, { sort: key, dir: query.sort === key && query.dir !== 'asc' ? 'asc' : 'desc', cursor: null })}>
                      {label}{query.sort === key && (query.dir === 'asc' ? ' \u2191' : ' \u2193')}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="text-right">Providers</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${m.slug}`}>{m.name}</Link>
                    <div className="text-xs text-[var(--muted)]">
                      {m.lab.name} · {m.modelType.toLowerCase()}
                      {m.pricing.free && <span className="text-[var(--accent)]"> · free</span>}
                    </div>
                  </td>
                  <td><CapabilityBadges caps={m.capabilities} /></td>
                  <td className="num">{contextLabel(m.contextWindow)}</td>
                  <td className="num">{pricePair(m.pricing.per1M.prompt, m.pricing.per1M.completion)}</td>
                  <td className="num text-[var(--muted)]">{dateLabel(m.releaseDate)}</td>
                  <td className="num text-right">{m.providerCount || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager basePath="/models" params={sp} meta={meta} />
    </div>
  );
}
