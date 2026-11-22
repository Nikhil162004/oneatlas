import Link from 'next/link';
import { listBenchmarks } from '@/lib/services/catalogue';
import { Empty, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Benchmarks' };

/**
 * The benchmarks as subjects: what exists, how much of the catalogue each has scored, and who
 * tops it. Until now a benchmark was only a filter chip on /rankings; this directory (and the
 * profile behind each row) is where a score's meaning lives — its category, its unit, and
 * whether higher is even better.
 */
export default async function BenchmarksPage() {
  const { data, meta } = await listBenchmarks().catch(() => ({ data: [], meta: { total: 0 } }));

  return (
    <div className="space-y-6">
      <div>
        <h1>Benchmarks</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          <span className="num">{meta.total} benchmarks</span> mirrored with the catalogue. Each profile lists every scored
          model in the benchmark's own direction; the leaderboard view is at{' '}
          <Link className="underline" href="/rankings">Rankings</Link>. Grid view:{' '}
          <Link className="underline" href="/benchmarks/matrix">Benchmark matrix</Link>.
        </p>
      </div>

      {!data.length ? (
        <Empty title="No benchmarks mirrored yet" hint="Run npm run ingest to fill the catalogue." />
      ) : (
        <>
          <Section id="table" title="All benchmarks" count={data.length} />
          <div className="tablewrap">
            <table className="stack-sm min-w-[900px] text-sm">
              <caption className="sr-only">Benchmarks with category, unit, scored model counts and the current top model</caption>
              <thead>
                <tr>
                  <th scope="col">Benchmark</th>
                  <th scope="col">Category</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Direction</th>
                  <th scope="col" className="text-right">Models scored</th>
                  <th scope="col">Top model</th>
                  <th scope="col" className="text-right">Top score</th>
                </tr>
              </thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b.slug}>
                    <td data-title>
                      <Link className="font-medium underline-offset-2 hover:underline" href={`/benchmarks/${b.slug}`}>{b.name}</Link>
                    </td>
                    <td>{b.category}</td>
                    <td>{b.unit}</td>
                    <td>{b.higherIsBetter ? 'higher is better' : 'lower is better'}</td>
                    <td className="num text-right">{b.scoredModels}</td>
                    <td>
                      {b.top ? (
                        <Link className="underline-offset-2 hover:underline" href={`/models/${b.top.modelSlug}`}>{b.top.modelName}</Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num text-right">{b.top ? b.top.score : '—'}</td>
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
