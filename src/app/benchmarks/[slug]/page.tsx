import Link from 'next/link';
import { notFound } from 'next/navigation';
import { benchmarkDetail } from '@/lib/services/catalogue';
import { Empty, Section } from '@/components/ui';
import { contextLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await benchmarkDetail(slug).catch(() => null);
  return { title: b ? b.name : 'Benchmark' };
}

/**
 * One benchmark, in full: every model it has scored, best first in the benchmark's own
 * direction (a latency index where lower wins is not sorted like an accuracy score). Scores
 * arrive with the catalogue mirror and are attributed per row, so this page and /rankings can
 * never disagree about who leads — they read the same table.
 */
export default async function BenchmarkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await benchmarkDetail(slug).catch(() => null);
  if (!b) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1>{b.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Category <span className="num">{b.category}</span>, unit <span className="num">{b.unit}</span>,{' '}
          {b.higherIsBetter ? 'higher is better' : 'lower is better'}.{' '}
          <span className="num">{b.scores.length} models scored</span>. Leaderboard view:{' '}
          <Link className="underline" href={`/rankings?benchmark=${b.slug}`}>Rankings</Link>.
        </p>
      </div>

      {!b.scores.length ? (
        <Empty title="No models scored yet" hint="Scores arrive with the catalogue mirror; check back after the next ingest." />
      ) : (
        <>
          <Section id="scores" title="Scores" count={b.scores.length} />
          <div className="tablewrap">
            <table className="stack-sm min-w-[800px] text-sm">
              <caption className="sr-only">Models scored on this benchmark, best first</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-right">Rank</th>
                  <th scope="col">Model</th>
                  <th scope="col">Lab</th>
                  <th scope="col" className="text-right">Context</th>
                  <th scope="col" className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {b.scores.map((s) => (
                  <tr key={s.model.slug}>
                    <td className="num text-right">{s.rank}</td>
                    <td data-title>
                      <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${s.model.slug}`}>{s.model.name}</Link>
                      <span className="block text-xs text-[var(--faint)]">{s.model.modelType.toLowerCase()}</span>
                    </td>
                    <td>{s.model.lab.name}</td>
                    <td className="num text-right">{contextLabel(s.model.contextWindow)}</td>
                    <td className="num text-right">{s.score}</td>
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
