'use client';

/**
 * The /compare screen as a component island (docs/decisions/0008). Ticking boxes and pressing
 * Compare fetches `GET /api/models/compare` and redraws only the table; the selection is still
 * carried in `?ids=`, written with pushState, so a comparison remains a link you can paste.
 * Attributes down the left, models across the top; differing rows are marked by colour, which a
 * server render could do too, but only a client can redo it the moment the selection changes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CapabilityTags, Empty, Notice, Section } from '@/components/ui';
import { contextLabel, dateLabel, pricePair } from '@/lib/format';
import { fetchApi, syncUrl } from '@/components/live';

type CompareResult = Awaited<ReturnType<typeof import('@/lib/services/catalogue').compareModels>>;
export type CompareRow = Omit<CompareResult['rows'][number], 'releaseDate'> & { releaseDate: string | null };
type Selected = CompareResult['selected'];
type BrowseItem = { id: string; slug: string; name: string; contextWindow: number };

export default function CompareExplorer({
  initialRows,
  initialSelected,
  initialSelection,
  requestedCount,
  browse,
}: {
  initialRows: CompareRow[];
  initialSelected: Selected;
  initialSelection: string[];
  requestedCount: number;
  browse: BrowseItem[];
}) {
  const [selection, setSelection] = useState<string[]>(initialSelection);
  const [picked, setPicked] = useState(requestedCount);
  const [rows, setRows] = useState<CompareRow[]>(initialRows);
  const [selected, setSelected] = useState<Selected>(initialSelected);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ id: number; ctrl: AbortController | null }>({ id: 0, ctrl: null });

  const effective = selection.slice(0, 6);

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
      setSelection(ids);
      setPicked(ids.length);
      void load(ids, false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load]);

  const applySelection = (next: string[]) => {
    setSelection(next);
    setPicked(next.length);
    void load(next, true);
  };

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
      {picked > 6 && (
        <p>
          <Notice>Only the first six of your {picked} models are compared. Drop one and the table stays readable.</Notice>
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
                          href={`/compare?ids=${effective.filter((s) => s !== m.slug).join(',')}`}
                          onClick={(e) => {
                            e.preventDefault();
                            applySelection(selection.filter((s) => s !== m.slug));
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
                    <td colSpan={rows.length} className="num break-all text-xs text-[var(--faint)]">/compare?ids={effective.join(',')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty
            title={effective.length ? 'None of those slugs are in the catalogue' : 'Pick two models to start'}
            hint={effective.length ? 'A compare link only works while both models are mirrored.' : undefined}
          />
        )}
      </div>

      <section>
        <Section id="picker" title={rows.length ? 'Swap a model in' : 'Recently released'} />
        <form
          method="get"
          action="/compare"
          className="card mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void load(selection, true);
          }}
        >
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {browse.map((m) => (
              <li key={m.id}>
                <label className="chip w-full justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      name="id"
                      value={m.slug}
                      checked={selection.includes(m.slug)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...selection, m.slug] : selection.filter((s) => s !== m.slug);
                        setSelection(next);
                        setPicked(next.length);
                      }}
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
                applySelection([]);
              }}
            >
              Clear
            </a>
            <span className="text-xs text-[var(--faint)]">2 to 6 boxes</span>
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
