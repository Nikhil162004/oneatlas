'use client';

/**
 * The /compare screen as a component island (docs/decisions/0008). Any model in the catalogue
 * can join the comparison: the search box queries `GET /api/models` and adds picks, the grid
 * below is the recent-release shortlist the server rendered, and Compare fetches
 * `GET /api/models/compare` and redraws only the table. The selection lives in `?ids=`,
 * written with pushState, so a comparison remains a link you can paste, and a model page's
 * "Compare this model" lands here with that model already picked, waiting for a second.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CapabilityTags, Empty, Notice, Section } from '@/components/ui';
import { contextLabel, dateLabel, pricePair } from '@/lib/format';
import type { ModelListItem } from '@/lib/present';
import { fetchApi, syncUrl } from '@/components/live';

type CompareResult = Awaited<ReturnType<typeof import('@/lib/services/catalogue').compareModels>>;
export type CompareRow = Omit<CompareResult['rows'][number], 'releaseDate'> & { releaseDate: string | null };
type Selected = CompareResult['selected'];
export type Pick = { slug: string; name: string; contextWindow: number };

export default function CompareExplorer({
  initialRows,
  initialSelected,
  initialPicks,
  browse,
}: {
  initialRows: CompareRow[];
  initialSelected: Selected;
  initialPicks: Pick[];
  browse: Pick[];
}) {
  const [picks, setPicks] = useState<Pick[]>(initialPicks);
  const [rows, setRows] = useState<CompareRow[]>(initialRows);
  const [selected, setSelected] = useState<Selected>(initialSelected);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [found, setFound] = useState<ModelListItem[]>([]);
  const request = useRef<{ id: number; ctrl: AbortController | null }>({ id: 0, ctrl: null });
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effective = picks.slice(0, 6);
  const slugs = picks.map((p) => p.slug);

  const load = useCallback(async (ids: string[], push: boolean) => {
    const use = ids.slice(0, 6);
    if (push) {
      const sp = new URLSearchParams();
      if (use.length) sp.set('ids', use.join(','));
      syncUrl('/compare', sp);
    }
    if (use.length < 2) {
      setRows([]);
      setSelected([]);
      return;
    }
    const id = ++request.current.id;
    request.current.ctrl?.abort();
    const ctrl = new AbortController();
    request.current.ctrl = ctrl;
    setLoading(true);
    setError(null);
    try {
      const { data } = await fetchApi<CompareResult, { count: number; requested: number }>(
        `/api/models/compare?ids=${encodeURIComponent(use.join(','))}`,
        ctrl.signal,
      );
      if (request.current.id !== id) return;
      setRows(data.rows as CompareRow[]);
      setSelected(data.selected);
    } catch (err) {
      if (request.current.id !== id || (err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'The comparison could not be refreshed.');
    } finally {
      if (request.current.id === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      const ids = (new URLSearchParams(window.location.search).get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      setPicks((prev) => ids.map((slug) => prev.find((p) => p.slug === slug) ?? { slug, name: slug, contextWindow: 0 }));
      void load(ids, false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load]);

  const toggle = (item: Pick, on: boolean) => {
    setPicks((prev) => (on ? [...prev.filter((p) => p.slug !== item.slug), item] : prev.filter((p) => p.slug !== item.slug)));
  };

  const search = (value: string) => {
    setTerm(value);
    if (debounce.current) clearTimeout(debounce.current);
    const q = value.trim();
    if (!q) {
      setFound([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const { data } = await fetchApi<ModelListItem[], unknown>(`/api/models?q=${encodeURIComponent(q)}&limit=8`, new AbortController().signal);
        setFound(data);
      } catch {
        setFound([]);
      }
    }, 300);
  };

  // Picks lead the grid: a model added from search (or arrived via ?ids=) is visible and
  // removable even when it is not among the 24 recent releases the server shortlisted.
  const grid: Pick[] = [...picks, ...browse.filter((b) => !slugs.includes(b.slug))];

  const benchSlugs = [...new Set(rows.flatMap((r) => Object.keys(r.benchmarks)))];
  const differs = (values: string[]) => new Set(values).size > 1;
  const attrs: Array<{ label: string; values: string[]; num?: boolean }> = [
    { label: 'Type', values: rows.map((m) => m.modelType.toLowerCase()) },
    { label: 'Context', values: rows.map((m) => contextLabel(m.contextWindow)), num: true },
    { label: 'Max output', values: rows.map((m) => contextLabel(m.maxOutputTokens)), num: true },
    { label: 'Cheapest in / out per 1M', values: rows.map((m) => pricePair(m.cheapest.prompt, m.cheapest.completion)), num: true },
    { label: 'Providers', values: rows.map((m) => String(m.providers.length)), num: true },
    { label: 'Served by', values: rows.map((m) => (m.providers.length ? m.providers.slice(0, 4).map((p) => p.provider).join(', ') : '—')) },
    { label: 'Released', values: rows.map((m) => dateLabel(m.releaseDate)), num: true },
    ...benchSlugs.map((b) => ({
      label: rows.find((r) => r.benchmarks[b])?.benchmarks[b]?.name ?? b,
      values: rows.map((m) => (m.benchmarks[b] ? m.benchmarks[b].score.toFixed(1) : '—')),
      num: true,
    })),
  ];

  return (
    <>
      {picks.length > 6 && (
        <p>
          <Notice>Only the first six of your {picks.length} models are compared. Drop one and the table stays readable.</Notice>
        </p>
      )}

      <div className="results-live" data-loading={loading || undefined} aria-busy={loading || undefined}>
        {error && <Notice>{error} The table below is the previous comparison.</Notice>}
        <span aria-live="polite" className="sr-only">{loading ? 'Updating the comparison' : ''}</span>
        {rows.length ? (
          <>
            <Section id="table" title="Side by side" count={rows.length} />
            <div className="tablewrap compare mt-4">
              <table className="text-sm">
                <caption className="sr-only">Comparison table with one row per attribute and one column per model</caption>
                <thead>
                  <tr>
                    <th scope="col">Attribute</th>
                    {rows.map((m) => (
                      <th key={m.id} scope="col">
                        <Link className="font-medium" href={`/models/${m.slug}`}>{m.name}</Link>
                        <span className="block text-xs font-normal text-[var(--faint)]">{m.lab.name}</span>
                        <a
                          className="mt-1 block text-xs text-[var(--faint)] underline"
                          href={`/compare?ids=${effective.filter((s) => s.slug !== m.slug).map((s) => s.slug).join(',')}`}
                          onClick={(e) => {
                            e.preventDefault();
                            const next = picks.filter((p) => p.slug !== m.slug);
                            setPicks(next);
                            void load(next.map((p) => p.slug), true);
                          }}
                        >
                          Remove
                        </a>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attrs.map((a) => (
                    <tr key={a.label}>
                      <th scope="row">{a.label}</th>
                      {a.values.map((v, i) => (
                        <td key={i} className={a.num ? 'num' : undefined} style={differs(a.values) ? { color: 'var(--fg)' } : { color: 'var(--muted)' }}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Capabilities</th>
                    {rows.map((m) => (
                      <td key={m.id}><CapabilityTags caps={m.capabilities} /></td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Build a link</th>
                    <td colSpan={rows.length} className="num break-all text-xs text-[var(--faint)]">/compare?ids={effective.map((p) => p.slug).join(',')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty
            title={picks.length === 1 ? 'One picked, pick at least one more' : picks.length ? 'None of those slugs are in the catalogue' : 'Pick two models to start'}
            hint={picks.length ? 'Use the search below, or tick another model in the list.' : undefined}
          />
        )}
      </div>

      <section>
        <Section id="picker" title={rows.length ? 'Swap a model in' : 'Find models to compare'} />
        <form
          method="get"
          action="/compare"
          className="card mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void load(slugs, true);
          }}
        >
          <label className="block">
            <span className="label mb-1 block">Search the catalogue and add</span>
            <input
              className="field w-full"
              type="search"
              name="q"
              value={term}
              onChange={(e) => search(e.target.value)}
              placeholder="any model, for example gpt, claude, llama"
              enterKeyHint="search"
              autoComplete="off"
            />
          </label>
          {found.length > 0 && (
            <ul className="mt-2 space-y-1">
              {found.map((m) => {
                const picked = slugs.includes(m.slug);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {m.name} <span className="text-xs text-[var(--faint)]">{m.lab.name}</span>
                    </span>
                    <button
                      type="button"
                      className="btn"
                      disabled={picked}
                      onClick={() => toggle({ slug: m.slug, name: m.name, contextWindow: m.contextWindow }, true)}
                    >
                      {picked ? 'Added' : 'Add'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((m) => (
              <li key={m.slug}>
                <label className="chip w-full justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      name="id"
                      value={m.slug}
                      checked={slugs.includes(m.slug)}
                      onChange={(e) => toggle(m, e.target.checked)}
                    />
                    <span className="truncate">{m.name}</span>
                  </span>
                  <span className="num text-[11px] text-[var(--faint)]">{contextLabel(m.contextWindow)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2">
            <button className="btn btn-primary" type="submit">Compare selection</button>
            <a
              className="btn"
              href="/compare"
              onClick={(e) => {
                e.preventDefault();
                setPicks([]);
                void load([], true);
              }}
            >
              Clear
            </a>
            <span className="text-xs text-[var(--faint)]">{picks.length} picked, 2 to 6 compared</span>
          </div>
        </form>
        {selected.some((s) => !s.found) && (
          <p className="mt-3">
            <Notice>Not loaded: {selected.filter((s) => !s.found).map((s) => s.slug).join(', ')}</Notice>
          </p>
        )}
        {!rows.length && <p className="mt-4 text-sm text-[var(--faint)]">Pick at least two models above to see the table.</p>}
      </section>
    </>
  );
}
