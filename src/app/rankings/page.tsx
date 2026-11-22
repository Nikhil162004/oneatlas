import Link from 'next/link';
import { rankings } from '@/lib/services/catalogue';
import { hrefWith, toSearchParams, type RawParams } from '@/lib/page';
import { parseQuery, rankingQuerySchema } from '@/lib/validation';
import { Empty, Notice } from '@/components/ui';
import { contextLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rankings' };

/**
 * Leaderboard. Offset paging here, keyset on /models: a rank is only meaningful as an absolute
 * position, so "give me rows 50-100 of this ordering" is the honest query.
 */
export default async function RankingsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const sp = toSearchParams(raw);
  const parsed = parseQuery(rankingQuerySchema, sp);
  if (!parsed.ok) {
    return <Notice>Those ranking params were rejected: {Object.keys(parsed.fields).join(', ')} · <Link className="underline" href="/rankings">reset</Link></Notice>;
  }

  const q = parsed.data;
  const { data, meta } = await rankings(q).catch(() => ({ data: [], meta: { total: 0, limit: q.limit, offset: q.offset, benchmarks: [] } }));
  const scored = meta.benchmarks.filter((b) => b.scored > 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Rankings</h1>
        <p className="text-sm text-[var(--muted)]">
          {meta.total ? `${meta.total} scored rows` : 'No scores mirrored yet'} · one row per model × benchmark.
        </p>
      </div>

      <nav aria-label="Benchmarks" className="flex flex-wrap gap-2">
        <Link className={`chip inline-flex min-h-[34px] items-center rounded border border-[var(--line)] px-2 text-sm ${!q.benchmark ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`} href={hrefWith(raw, { benchmark: null, offset: null })}>All</Link>
        {scored.map((b) => (
          <Link key={b.slug} className={`chip inline-flex min-h-[34px] items-center gap-1.5 rounded border border-[var(--line)] px-2 text-sm ${q.benchmark === b.slug ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`} href={hrefWith(raw, { benchmark: b.slug, offset: null })}>
            {b.name}<span className="num text-[11px] text-[var(--muted)]">{b.scored}</span>
          </Link>
        ))}
      </nav>

      {!data.length ? (
        <Empty title="Nothing scored on that benchmark" hint="Only models whose upstream record carried a score are in here; most of the catalogue has none." />
      ) : (
        <div className="tablewrap">
          <table className="min-w-[800px] text-sm">
            <caption className="sr-only">Models ranked by score, best first</caption>
            <thead>
              <tr>
                <th scope="col" className="w-14 text-right">#</th>
                <th scope="col">Model</th>
                <th scope="col">Benchmark</th>
                <th scope="col" className="text-right">Score</th>
                <th scope="col" className="text-right">Context</th>
                <th scope="col" className="text-right">Cheapest in /1M</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={`${r.model.id}-${r.benchmark.slug}`}>
                  <td className="num text-right text-[var(--muted)]">{r.rank}</td>
                  <td>
                    <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${r.model.slug}`}>{r.model.name}</Link>
                    <div className="text-xs text-[var(--muted)]">{r.model.lab.name} · {r.model.modelType.toLowerCase()}</div>
                  </td>
                  <td className="text-[var(--muted)]">{r.benchmark.name}<div className="text-[11px]">{r.benchmark.category}</div></td>
                  <td className="num text-right font-medium">{r.score.toFixed(2)}<span className="ml-1 text-[11px] text-[var(--muted)]">{r.benchmark.slug.includes('artificial') ? '' : ''}</span></td>
                  <td className="num text-right">{contextLabel(r.model.contextWindow)}</td>
                  <td className="num text-right">{priceLabel(r.cheapestPromptPer1M)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Pages" className="flex items-center gap-4 text-sm">
        {meta.offset > 0 ? (
          <Link className="underline" href={hrefWith(raw, { offset: String(Math.max(0, meta.offset - meta.limit)) })}>&larr; {meta.limit} earlier</Link>
        ) : <span className="text-[var(--muted)]">Start of list</span>}
        <span className="num text-[var(--muted)]">{meta.total ? `rows ${meta.offset + 1}\u2013${Math.min(meta.total, meta.offset + meta.limit)} of ${meta.total}` : ''}</span>
        {meta.offset + meta.limit < meta.total ? (
          <Link className="underline" href={hrefWith(raw, { offset: String(meta.offset + meta.limit) })}>next {meta.limit} &rarr;</Link>
        ) : <span className="text-[var(--muted)]">End of list</span>}
      </nav>
    </div>
  );
}
