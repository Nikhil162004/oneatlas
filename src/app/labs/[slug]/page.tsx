import Link from 'next/link';
import { notFound } from 'next/navigation';
import { labDetail } from '@/lib/services/catalogue';
import { Empty, StatRow } from '@/components/ui';
import { contextLabel, dateLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug };
}

/** Lab profile + release cadence. There is no Release table on purpose: a model row is a release. */
export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = await labDetail(slug).catch(() => null);
  if (!lab) notFound();

  const max = Math.max(1, ...lab.releases.map((r) => r.count));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]"><Link className="underline" href="/labs">Labs</Link> / {lab.slug}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{lab.name}</h1>
        {lab.summary && <p className="mt-2 max-w-prose text-[var(--muted)]">{lab.summary}</p>}
        {lab.website && <p className="mt-1 text-sm"><a className="underline" href={lab.website} rel="noopener noreferrer" target="_blank">{lab.website.replace(/^https?:\/\//, '')}</a></p>}
      </div>

      <StatRow items={[['Models', lab.modelCount], ['Open weights', lab.models.filter((m) => m.openWeights).length], ['Reasoning', lab.models.filter((m) => m.reasoning).length], ['Deprecated', lab.models.filter((m) => m.deprecated).length]]} />

      {lab.releases.length > 0 && (
        <section aria-labelledby="cadence">
          <h2 id="cadence" className="mb-2 text-lg font-semibold">Release cadence</h2>
          <ul className="flex flex-wrap items-end gap-1" role="list">
            {lab.releases.slice(0, 24).map((r) => (
              <li key={r.month} className="w-9 text-center" title={`${r.month}: ${r.count} model${r.count > 1 ? 's' : ''}`}>
                <span className="num block text-[11px] text-[var(--muted)]">{r.count}</span>
                {/* The height is a percentage of the busiest month; the number is the source of truth. */}
                <span className="block bg-[var(--accent)]" style={{ height: `${8 + (r.count / max) * 56}px` }} />
                <span className="block text-[11px] text-[var(--faint)]">{r.month.slice(2)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!lab.models.length ? (
        <Empty title="No models attributed to this lab" />
      ) : (
        <div className="tablewrap">
          <table className="min-w-[760px] text-sm">
            <thead>
              <tr><th scope="col">Model</th><th scope="col" className="text-right">Context</th><th scope="col" className="text-right">Cheapest in /1M</th><th scope="col" className="text-right">Served by</th><th scope="col" className="text-right">Released</th></tr>
            </thead>
            <tbody>
              {lab.models.map((m) => (
                <tr key={m.slug}>
                  <td>
                    <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${m.slug}`}>{m.name}</Link>
                    <div className="text-xs text-[var(--muted)]">{m.modelType.toLowerCase()}{m.deprecated && ' · deprecated'}{m.openWeights && ' · open weights'}</div>
                  </td>
                  <td className="num text-right">{contextLabel(m.contextWindow)}</td>
                  <td className="num text-right">{priceLabel(m.cheapestPer1M)}</td>
                  <td className="text-right text-[var(--muted)]">{m.cheapestProvider ?? '\u2014'}</td>
                  <td className="num text-right">{dateLabel(m.releaseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
