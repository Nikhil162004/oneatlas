'use client';

/**
 * The /models screen as a component island (docs/decisions/0008). The server renders this same
 * markup for the first paint; once hydrated, Apply, the filter chips, the sort headers and Next
 * fetch `GET /api/models` and replace only the table region. The controls keep their native form
 * semantics (`method="get" action="/models"`, links with real hrefs), so with JavaScript off the
 * screen behaves exactly as it did when it was server-only.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CapabilityTags, FilterBar, Notice, Pager, Empty } from '@/components/ui';
import { contextLabel, dateLabel, pricePair } from '@/lib/format';
import { hrefWith, type RawParams } from '@/lib/page';
import type { ModelListItem } from '@/lib/present';
import { fetchApi, syncUrl, queryFromAnchor } from '@/components/live';
import { AddToCompare } from '@/components/tray';
import { WatchButton } from '@/components/watchlist';

type Meta = { total: number | null; limit: number; sort: string; dir?: string; nextCursor: string | null };
type Directory = Array<{ slug: string; name: string; modelCount: number }>;

const CHIP_LABEL: Record<string, string> = {
  reasoning: 'reasoning',
  tools: 'tool calling',
  structured: 'structured output',
  vision: 'vision input',
  openWeights: 'open weights',
};

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

type Draft = {
  q: string; capabilities: string[]; lab: string; provider: string; type: string;
  free: boolean; hideDeprecated: boolean; minContext: string; maxPrice: string; sort: string;
};

function draftFrom(params: URLSearchParams): Draft {
  return {
    q: params.get('q') ?? '',
    capabilities: (params.get('capabilities') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    lab: params.get('lab') ?? '',
    provider: params.get('provider') ?? '',
    type: params.get('type') ?? '',
    free: params.get('free') === 'true',
    hideDeprecated: params.get('hideDeprecated') === 'true',
    minContext: params.get('minContext') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    sort: params.get('sort') ?? 'released',
  };
}

/** The params the native form would have submitted for this draft: empty fields are "not set". */
function paramsFromDraft(d: Draft): URLSearchParams {
  const sp = new URLSearchParams();
  if (d.q.trim()) sp.set('q', d.q.trim());
  if (d.capabilities.length) sp.set('capabilities', d.capabilities.join(','));
  if (d.lab.trim()) sp.set('lab', d.lab.trim());
  if (d.provider.trim()) sp.set('provider', d.provider.trim());
  if (d.type) sp.set('type', d.type);
  if (d.minContext.trim()) sp.set('minContext', d.minContext.trim());
  if (d.maxPrice.trim()) sp.set('maxPrice', d.maxPrice.trim());
  if (d.free) sp.set('free', 'true');
  if (d.hideDeprecated) sp.set('hideDeprecated', 'true');
  sp.set('sort', d.sort);
  return sp;
}

function rawFrom(params: URLSearchParams): RawParams {
  const raw: RawParams = {};
  for (const [k, v] of params.entries()) raw[k] = v;
  return raw;
}

export default function ModelsExplorer({
  initialData,
  initialMeta,
  labs,
  providers,
  initialSearch,
  capabilities,
  modelTypes,
  sortKeys,
}: {
  initialData: ModelListItem[];
  initialMeta: Meta;
  labs: Directory;
  providers: Directory;
  initialSearch: string;
  capabilities: readonly string[];
  modelTypes: readonly string[];
  sortKeys: readonly string[];
}) {
  const [applied, setApplied] = useState(() => new URLSearchParams(initialSearch));
  const [draft, setDraft] = useState<Draft>(() => draftFrom(new URLSearchParams(initialSearch)));
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ id: number; ctrl: AbortController | null }>({ id: 0, ctrl: null });

  const load = useCallback(async (next: URLSearchParams, push: boolean) => {
    const id = ++request.current.id;
    request.current.ctrl?.abort();
    const ctrl = new AbortController();
    request.current.ctrl = ctrl;
    setLoading(true);
    setError(null);
    setApplied(new URLSearchParams(next));
    setDraft(draftFrom(next));
    // The old cursor was minted for the old query: drop it now, or the pager briefly renders a
    // new-sort/old-cursor href (which Next then prefetches, and the API rightly rejects the
    // foreign cursor with a 503).
    setMeta((prev) => ({ ...prev, nextCursor: null }));
    if (push) syncUrl('/models', next);
    try {
      const qs = next.toString();
      const { data: rows, meta: m } = await fetchApi<ModelListItem[], Meta>(`/api/models${qs ? `?${qs}` : ''}`, ctrl.signal);
      if (request.current.id !== id) return; // a newer click already won
      setData(rows);
      setMeta(m);
    } catch (err) {
      if (request.current.id !== id || (err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'The list could not be refreshed.');
    } finally {
      if (request.current.id === id) setLoading(false);
    }
  }, []);

  // Back/forward: the URL changed without us, so re-read it and fetch what it says.
  useEffect(() => {
    const onPop = () => void load(new URLSearchParams(window.location.search), false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load]);

  const raw = rawFrom(applied);
  const sort = applied.get('sort') ?? 'released';
  const dir = applied.get('dir') ?? undefined;

  /** Chips, sort headers and the pager are anchors whose href is the next query; follow it in place. */
  const followQueryLink = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.chip-x, a.subbar-clear, a.sortlink, nav[aria-label="Pagination"] a.btn');
    if (!anchor) return;
    e.preventDefault();
    const next = queryFromAnchor(anchor);
    // Changing what is filtered invalidates a keyset cursor minted for the old filter.
    if (anchor.classList.contains('chip-x') || anchor.classList.contains('subbar-clear')) next.delete('cursor');
    void load(next, true);
  };

  return (
    <>
      <form
        method="get"
        action="/models"
        className="card grid gap-4 lg:grid-cols-[2fr_1fr_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          void load(paramsFromDraft(draft), true);
        }}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="label mb-1 block">Search</span>
            <input className="field w-full" type="text" name="q" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="claude, llama, whisper" enterKeyHint="search" autoComplete="off" />
          </label>
          <fieldset>
            <legend className="label mb-1 block">Capabilities</legend>
            <div className="flex flex-wrap gap-2">
              {capabilities.map((c) => (
                <label key={c} className="chip">
                  <input
                    type="checkbox"
                    name="capabilities"
                    value={c}
                    checked={draft.capabilities.includes(c)}
                    onChange={(e) => setDraft({ ...draft, capabilities: e.target.checked ? [...draft.capabilities, c] : draft.capabilities.filter((x) => x !== c) })}
                  />
                  {CHIP_LABEL[c] ?? c}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="label mb-1 block">Lab</span>
            <input className="field w-full" list="labs" name="lab" value={draft.lab} onChange={(e) => setDraft({ ...draft, lab: e.target.value })} placeholder="any" enterKeyHint="search" autoComplete="off" />
            <datalist id="labs">
              {labs.map((l) => <option key={l.slug} value={l.slug}>{`${l.name} ${l.modelCount}`}</option>)}
            </datalist>
          </label>
          <label className="block">
            <span className="label mb-1 block">Provider</span>
            <input className="field w-full" list="providers" name="provider" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} placeholder="any" enterKeyHint="search" autoComplete="off" />
            <datalist id="providers">
              {providers.map((pv) => <option key={pv.slug} value={pv.slug}>{`${pv.name} ${pv.modelCount}`}</option>)}
            </datalist>
          </label>
          <label className="block">
            <span className="label mb-1 block">Type</span>
            <select className="field w-full" name="type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option value="">Any</option>
              {modelTypes.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="chip">
              <input type="checkbox" name="free" value="true" checked={draft.free} onChange={(e) => setDraft({ ...draft, free: e.target.checked })} /> free tier
            </label>
            <label className="chip">
              <input type="checkbox" name="hideDeprecated" value="true" checked={draft.hideDeprecated} onChange={(e) => setDraft({ ...draft, hideDeprecated: e.target.checked })} /> hide deprecated
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="label mb-1 block">Min context</span>
            <input className="field w-full num" type="text" inputMode="numeric" pattern="[0-9]*" name="minContext" value={draft.minContext} onChange={(e) => setDraft({ ...draft, minContext: e.target.value })} placeholder="128000" enterKeyHint="search" autoComplete="off" />
          </label>
          <label className="block">
            <span className="label mb-1 block">Max input price per 1M</span>
            <input className="field w-full num" type="text" inputMode="decimal" name="maxPrice" value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} placeholder="any" enterKeyHint="search" autoComplete="off" />
          </label>
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="label mb-1 block">Sort</span>
              <select className="field w-full" name="sort" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value })}>
                {sortKeys.map((k) => <option key={k} value={k}>{SORT_LABEL[k] ?? k}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" type="submit">Apply</button>
          </div>
        </div>
      </form>

      <div onClick={followQueryLink}>
        <FilterBar
          path="/models"
          raw={raw}
          count={meta.total === null ? `${data.length} shown` : `${meta.total} matching`}
          note={`sorted by ${SORT_LABEL[sort] ?? sort}${dir === 'asc' ? ', ascending' : ''}`}
          fields={FILTER_FIELDS}
        />

        {error && <Notice>{error} The rows below are the previous result.</Notice>}
        <span aria-live="polite" className="sr-only">{loading ? 'Updating the model list' : ''}</span>

        <div className="results-live" data-loading={loading || undefined} aria-busy={loading || undefined}>
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
                      const active = sort === key;
                      const nextDir = active && dir !== 'asc' ? 'asc' : 'desc';
                      return (
                        <th key={key} scope="col" className={key === 'context' || key === 'priceLow' ? 'text-right' : undefined} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <Link className="sortlink justify-end" href={hrefWith(raw, { sort: key, dir: nextDir, cursor: null })} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                            {label}
                            <span className="num text-[11px]" aria-hidden="true">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
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
                        <span className="mt-1.5 flex flex-wrap gap-2">
                          <AddToCompare slug={m.slug} name={m.name} />
                          <WatchButton slug={m.slug} name={m.name} />
                        </span>
                      </td>
                      <td data-label="Capabilities"><CapabilityTags caps={m.capabilities} /></td>
                      <td data-label="Context" className="num text-right">{contextLabel(m.contextWindow)}</td>
                      <td data-label="In / out per 1M" className="num text-right">{pricePair(m.pricing.per1M.prompt, m.pricing.per1M.completion)}</td>
                      <td data-label="Released" className="num text-right text-[var(--muted)]">{dateLabel(m.releaseDate)}</td>
                      <td data-label="Providers" className="num text-right">{m.providerCount || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Pager
          params={applied}
          meta={meta}
          pageHref={(cursor) => hrefWith(raw, { cursor })}
        />
      </div>
    </>
  );
}
