import Link from 'next/link';
import { rankings } from '@/lib/services/catalogue';
import { hrefWith, toSearchParams, type RawParams } from '@/lib/page';
import { parseQuery, rankingQuerySchema } from '@/lib/validation';
import { Empty, Meter, Notice, Section } from '@/components/ui';
import { contextLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rankings' };

/**
 * Leaderboard. Offset paging, not the keyset cursor /models uses: a rank only means something as an
 * absolute position, so "rows 50 to 100 of this ordering" is the honest query here.
 */
export default async function RankingsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const sp = toSearchParams(raw);
  const parsed = parseQuery(rankingQuerySchema, sp);
  if (!parsed.ok) {
    return (
      <Notice>
        Those ranking params were rejected: {Object.keys(parsed.fields).join(', ')}.{' '}
        <Link className="underline" href="/rankings">Reset</Link>.
      </Notice>
    );
  }

  const q = parsed.data;
  const { data, meta } = await rankings(q).catch(() => ({ data: [], meta: { total: 0, limit: q.limit, offset: q.offset, benchmarks: [] } }));
  const scored = meta.benchmarks.filter((b) => b.scored > 0);
  const top = Math.max(1, ...data.map((r) => r.score));

  return (
    <div className="space-y-6">
      <div>
        <h1>Rankings</h1>
        <p className="num mt-1 text-sm text-[var(--muted)]">
          {meta.total ? `${meta.total} scored rows` : 'No scores mirrored yet'} · one row per model and benchmark
        </p>
      </div>

      <nav aria-label="Benchmarks" className="flex flex-wrap gap-2">
        <Link className="chip" href={hrefWith(raw, { benchmark: null, offset: null })} aria-current={!q.benchmark ? 'true' : undefined} style={!q.benchmark ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>
          all benchmarks
        </Link>
        {scored.map((b) => {
          const active = q.benchmark === b.slug;
          return (
            <Link key={b.slug} className="chip" href={hrefWith(raw, { benchmark: b.slug, offset: null })} aria-current={active ? 'true' : undefined} style={active ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>
              {b.name}
              <span className="num text-[11px] text-[var(--faint)]">{b.scored}</span>
            </Link>
          );
        })}
      </nav>

      {!data.length ? (
        <Empty
          title="Nothing scored on that benchmark"
          hint="Only models whose catalogue entry carried a score are in here, so most of them are not."
          action={{ href: '/rankings', label: 'All benchmarks' }}
        />
      ) : (
        <>
          <Section id="board" title={q.benchmark ? (data[0]?.benchmark.name ?? 'Rankings') : 'Overall'} right={<small className="num">{meta.total} rows</small>} />
          <div className="tablewrap">
            <table className="stack-sm min-w-[760px] text-sm">
              <caption className="sr-only">Models ranked by score, best first</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-16 text-right">Rank</th>
                  <th scope="col">Model</th>
                  <th scope="col">Benchmark</th>
                  <th scope="col" className="text-right">Score</th>
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
                      <Link className="font-medium" href={`/models/${r.model.slug}`}>{r.model.name}</Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--faint)]">
                        <span className="tag">{r.model.modelType.toLowerCase()}</span>
                        {r.model.lab.name}
                      </span>
                    </td>
                    <td data-label="Benchmark" className="text-[var(--muted)]">{r.benchmark.name}</td>
                    <td data-label="Score" className="num text-right font-medium">{r.score.toFixed(2)}</td>
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
              <Link className="btn" href={hrefWith(raw, { offset: String(Math.max(0, meta.offset - meta.limit)) })}>Previous {meta.limit}</Link>
            ) : <span className="text-sm text-[var(--faint)]">First page</span>}
            <span className="num text-sm text-[var(--muted)]">
              {meta.total ? `rows ${meta.offset + 1}\u2013${Math.min(meta.total, meta.offset + meta.limit)} of ${meta.total}` : ''}
            </span>
            {meta.offset + meta.limit < meta.total ? (
              <Link className="btn" href={hrefWith(raw, { offset: String(meta.offset + meta.limit) })}>Next {meta.limit}</Link>
            ) : <span className="text-sm text-[var(--faint)]">Last page</span>}
          </nav>
        </>
      )}
    </div>
  );
}
