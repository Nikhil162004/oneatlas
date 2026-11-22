import Link from 'next/link';
import { benchmarkMatrix } from '@/lib/services/catalogue';
import { Empty, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Benchmark matrix' };

/**
 * Models against benchmarks in one grid: the 25 most-scored models across the 8 most-populated
 * benchmarks. A missing cell is information (that benchmark never scored that model), and the
 * flag marks the best score in each column in that benchmark's own direction — lower-is-better
 * columns crown their minimum, not their maximum.
 */
export default async function MatrixPage() {
  const { data } = await benchmarkMatrix().catch(() => ({ data: { benchmarks: [], rows: [] } }));

  return (
    <div className="space-y-6">
      <div>
        <h1>Benchmark matrix</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The most-scored models against the most-populated benchmarks. One score per cell; the flag is the
          column's best. Directory view: <Link className="underline" href="/benchmarks">Benchmarks</Link>.
        </p>
      </div>

      {!data.rows.length ? (
        <Empty title="No scores mirrored yet" hint="Run npm run ingest to fill the catalogue." />
      ) : (
        <>
          <Section id="grid" title="Scores grid" count={data.rows.length} />
          <div className="tablewrap">
            <table className="stack-sm min-w-[1000px] text-sm">
              <caption className="sr-only">Models by benchmark scores, best score per benchmark flagged</caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col" className="text-right">Scored on</th>
                  {data.benchmarks.map((b) => (
                    <th key={b.slug} scope="col" className="text-right">
                      <Link className="underline-offset-2 hover:underline" href={`/benchmarks/${b.slug}`}>{b.name}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.model.slug}>
                    <td data-title>
                      <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${r.model.slug}`}>{r.model.name}</Link>
                      <span className="block text-xs text-[var(--faint)]">{r.model.lab.name}</span>
                    </td>
                    <td className="num text-right">{r.scoredCount}</td>
                    {r.cells.map((c, i) => (
                      <td key={data.benchmarks[i]!.slug} className="num text-right">
                        {c === null ? (
                          <span className="text-[var(--faint)]">—</span>
                        ) : (
                          <>
                            {c.score}
                            {c.best && <span className="flag ml-1">best</span>}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
