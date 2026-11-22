'use client';

/**
 * The /rankings board as a component island (docs/decisions/0008). Benchmark chips, the two
 * category selects and the offset pager fetch `GET /api/rankings` and replace only the board;
 * the server still renders the first board, so `/rankings?category=...` in view-source is the
 * filtered table, not a shell.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Empty, Meter, Notice, Section } from '@/components/ui';
import { contextLabel, priceLabel } from '@/lib/format';
import { hrefWith, type RawParams } from '@/lib/page';
import { fetchApi, syncUrl, queryFromAnchor } from '@/components/live';

type RankingsResult = Awaited<ReturnType<typeof import('@/lib/services/catalogue').rankings>>;
type Row = RankingsResult['data'][number];
type Meta = RankingsResult['meta'];

function rawFrom(params: URLSearchParams): RawParams {
  const raw: RawParams = {};
  for (const [k, v] of params.entries()) raw[k] = v;
  return raw;
}

export default function RankingsExplorer({
  initialData,
  initialMeta,
  initialSearch,
  modelTypes,
}: {
  initialData: Row[];
  initialMeta: Meta;
  initialSearch: string;
  modelTypes: readonly string[];
}) {
  const [applied, setApplied] = useState(() => new URLSearchParams(initialSearch));
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(initialMeta);
  const [type, setType] = useState(applied.get('type') ?? '');
  const [category, setCategory] = useState(applied.get('category') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ id: number; ctrl: AbortController | null }>({ id: 0, ctrl: null });

  const benchmark = applied.get('benchmark') ?? undefined;
  const view = applied.get('view') === 'value' ? 'value' : 'score';

  const load = useCallback(async (next: URLSearchParams, push: boolean) => {
    const id = ++request.current.id;
    request.current.ctrl?.abort();
    const ctrl = new AbortController();
    request.current.ctrl = ctrl;
    setLoading(true);
    setError(null);
    setApplied(new URLSearchParams(next));
    setType(next.get('type') ?? '');
    setCategory(next.get('category') ?? '');
    if (push) syncUrl('/rankings', next);
    try {
      const qs = next.toString();
      const { data: rows, meta: m } = await fetchApi<Row[], Meta>(`/api/rankings${qs ? `?${qs}` : ''}`, ctrl.signal);
      if (request.current.id !== id) return;
      setData(rows);
      setMeta(m);
    } catch (err) {
      if (request.current.id !== id || (err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'The board could not be refreshed.');
    } finally {
      if (request.current.id === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onPop = () => void load(new URLSearchParams(window.location.search), false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load]);

  const raw = rawFrom(applied);
  const scored = meta.benchmarks.filter((b) => b.scored > 0);
  // Benchmark families come out of the mirrored rows, not out of an enum: a category with no
  // scored model is not offered, because a filter that always returns nothing is a broken control.
  const families = [...new Set(scored.map((b) => b.category))].filter(Boolean).sort();
  const top = Math.max(1, ...data.map((r) => r.score));

  /** Benchmark chips and the offset pager are anchors whose href is the next query. */
  const followQueryLink = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('nav[aria-label="Benchmarks"] a.chip, nav[aria-label="Pages"] a.btn, nav[aria-label="Board view"] a.chip');
    if (!anchor) return;
    e.preventDefault();
    void load(queryFromAnchor(anchor), true);
  };

  return (
    <div className="space-y-6" onClick={followQueryLink}>
      <p className="num mt-1 text-sm text-[var(--muted)]">
        {meta.total ? `${meta.total} scored rows` : 'No scores mirrored yet'} · one row per model and benchmark
      </p>

      <nav aria-label="Board view" className="flex flex-wrap items-center gap-2">
        <a className="chip" href={hrefWith(raw, { view: null, offset: null })} aria-current={view === 'score' ? 'true' : undefined}>Top scores</a>
        <a className="chip" href={hrefWith(raw, { view: 'value', offset: null })} aria-current={view === 'value' ? 'true' : undefined}>Best value</a>
        {view === 'value' && <span className="text-xs text-[var(--faint)]">score per dollar of cheapest input (per 1M), unpriced models excluded</span>}
      </nav>

      <nav aria-label="Benchmarks" className="flex flex-wrap gap-2">
        <a className="chip" href={hrefWith(raw, { benchmark: null, offset: null })} aria-current={!benchmark ? 'true' : undefined}>
          all benchmarks
        </a>
        {scored.map((b) => (
          <a key={b.slug} className="chip" href={hrefWith(raw, { benchmark: b.slug, offset: null })} aria-current={benchmark === b.slug ? 'true' : undefined}>
            {b.name}
            <span className="num text-[11px] text-[var(--faint)]">{b.scored}</span>
          </a>
        ))}
      </nav>

      {/* Categories, the other half of "filter by model categories and benchmarks". A select rather
          than chips because there are eleven model types and seven benchmark families. */}
      <form
        method="get"
        action="/rankings"
        className="card grid max-w-2xl gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = new URLSearchParams(applied);
          if (type) next.set('type', type); else next.delete('type');
          if (category) next.set('category', category); else next.delete('category');
          next.delete('offset');
          void load(next, true);
        }}
      >
        <label className="block">
          <span className="label mb-1 block">Model category</span>
          <select className="field w-full" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All categories</option>
            {modelTypes.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label mb-1 block">Benchmark family</span>
          <select className="field w-full" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All families</option>
            {families.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {benchmark && <input type="hidden" name="benchmark" value={benchmark} />}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button className="btn btn-primary" type="submit">Apply</button>
          {(type || category) && (
            <a
              className="text-sm underline text-[var(--muted)]"
              href={hrefWith(raw, { type: null, category: null, offset: null })}
              onClick={(e) => {
                e.preventDefault();
                const next = new URLSearchParams(applied);
                next.delete('type');
                next.delete('category');
                next.delete('offset');
                void load(next, true);
              }}
            >
              clear categories
            </a>
          )}
          <span className="num text-xs text-[var(--faint)]">
            {data.length} of {meta.total} rows
          </span>
        </div>
      </form>

      {error && <Notice>{error} The rows below are the previous result.</Notice>}
      <span aria-live="polite" className="sr-only">{loading ? 'Updating the rankings' : ''}</span>

      <div className="results-live space-y-6" data-loading={loading || undefined} aria-busy={loading || undefined}>
        {!data.length ? (
          <Empty
            title="Nothing scored with those filters"
            hint="Only models whose catalogue entry carried a score are mirrored, so most of them are not in this board at all. A category that exists in the catalogue but has no scored model returns nothing here, and that is a fact about the data, not an empty state to design around."
            action={{ href: '/rankings', label: 'Reset the board' }}
          />
        ) : (
          <>
            <Section id="board" title={benchmark ? (data[0]?.benchmark.name ?? 'Rankings') : 'Overall'} right={<small className="num">{meta.total} rows</small>} />
            <div className="tablewrap">
              <table className="stack-sm min-w-[760px] text-sm">
                <caption className="sr-only">Models ranked by score, best first</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-16 text-right">Rank</th>
                    <th scope="col">Model</th>
                    <th scope="col">Benchmark</th>
                    <th scope="col" className="text-right">Score</th>
                    {view === 'value' && <th scope="col" className="text-right">Value</th>}
                    <th scope="col" className="w-40">Against the leader</th>
                    <th scope="col" className="text-right">Context</th>
                    <th scope="col" className="text-right">Cheapest input</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr key={`${r.model.id}-${r.benchmark.slug}`}>
                      <td data-label="Rank" className="num text-right">
                        {r.rank <= 3 ? <span className="flag flag-quiet justify-end">{r.rank}</span> : <span className="text-[var(--faint)]">{r.rank}</span>}
                      </td>
                      <td data-title>
                        <Link className="rowlink font-medium" href={`/models/${r.model.slug}`}>{r.model.name}</Link>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--faint)]">
                          <span className="tag">{r.model.modelType.toLowerCase()}</span>
                          {r.model.lab.name}
                        </span>
                      </td>
                      <td data-label="Benchmark" className="text-[var(--muted)]">{r.benchmark.name}</td>
                      <td data-label="Score" className="num text-right font-medium">{r.score.toFixed(2)}</td>
                      {view === 'value' && <td data-label="Value" className="num text-right">{r.value !== null ? r.value.toFixed(0) : '—'}</td>}
                      <td data-label="Against the leader"><Meter value={r.score} max={top} /></td>
                      <td data-label="Context" className="num text-right">{contextLabel(r.model.contextWindow)}</td>
                      <td data-label="Cheapest input" className="num text-right">{priceLabel(r.cheapestPromptPer1M)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav aria-label="Pages" className="rowline">
              {meta.offset > 0 ? (
                <a className="btn" href={hrefWith(raw, { offset: String(Math.max(0, meta.offset - meta.limit)) })}>Previous {meta.limit}</a>
              ) : <span className="text-sm text-[var(--faint)]">First page</span>}
              <span className="num text-sm text-[var(--muted)]">
                {meta.total ? `rows ${meta.offset + 1}–${Math.min(meta.total, meta.offset + meta.limit)} of ${meta.total}` : ''}
              </span>
              {meta.offset + meta.limit < meta.total ? (
                <a className="btn" href={hrefWith(raw, { offset: String(meta.offset + meta.limit) })}>Next {meta.limit}</a>
              ) : <span className="text-sm text-[var(--faint)]">Last page</span>}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
