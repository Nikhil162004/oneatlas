import Link from 'next/link';
import { notFound } from 'next/navigation';
import { labDetail } from '@/lib/services/catalogue';
import { Empty, Section, StatRow } from '@/components/ui';
import { contextLabel, dateLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug };
}

/** Lab profile and release cadence. No Release table on purpose: a model row already is a release. */
export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = await labDetail(slug).catch(() => null);
  if (!lab) notFound();

  const max = Math.max(1, ...lab.releases.map((r) => r.count));

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm text-[var(--faint)]">
          <Link className="underline" href="/labs">Labs</Link> / {lab.slug}
        </p>
        <h1 className="mt-2">{lab.name}</h1>
        {lab.summary && <p className="lede mt-3">{lab.summary}</p>}
        {lab.website && (
          <p className="mt-3 text-sm">
            <a className="underline text-[var(--muted)]" href={lab.website} rel="noopener noreferrer" target="_blank">
              {lab.website.replace(/^https?:\/\//, '')}
            </a>
          </p>
        )}
      </section>

      <StatRow
        items={[
          ['Models', lab.modelCount],
          ['Open weights', lab.models.filter((m) => m.openWeights).length],
          ['Reasoning', lab.models.filter((m) => m.reasoning).length],
          ['Deprecated', lab.models.filter((m) => m.deprecated).length],
        ]}
      />

      {lab.releases.length > 0 && (
        <section>
          <Section id="cadence" title="Release cadence" right={<small>models shipped per month</small>} />
          <ul className="flex flex-wrap items-end gap-2">
            {lab.releases.slice(0, 24).map((r) => (
              <li key={r.month} className="w-12 text-center" title={`${r.month}: ${r.count} models`}>
                <span className="num block text-[13px] text-[var(--muted)]">{r.count}</span>
                <span className="mt-1 block rounded-sm bg-[var(--accent)]" style={{ height: `${Math.max(2, (r.count / max) * 56)}px` }} />
                <span className="num mt-1 block text-[11px] text-[var(--faint)]">{r.month.slice(2)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!lab.models.length ? (
        <Empty title="No models attributed to this lab" />
      ) : (
        <div className="tablewrap">
          <table className="stack-sm min-w-[720px] text-sm">
            <caption className="sr-only">Models trained by this lab, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col" className="text-right">Context</th>
                <th scope="col" className="text-right">Cheapest input</th>
                <th scope="col" className="text-right">Served by</th>
                <th scope="col" className="text-right">Released</th>
              </tr>
            </thead>
            <tbody>
              {lab.models.map((m) => (
                <tr key={m.slug}>
                  <td data-title>
                    <Link className="rowlink font-medium" href={`/models/${m.slug}`}>{m.name}</Link>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--faint)]">
                      <span className="tag">{m.modelType.toLowerCase()}</span>
                      {m.openWeights && <span className="tag tag-on">open weights</span>}
                      {m.deprecated && <span className="flag flag-warn">deprecated</span>}
                    </span>
                  </td>
                  <td data-label="Context" className="num text-right">{contextLabel(m.contextWindow)}</td>
                  <td data-label="Cheapest input" className="num text-right">{priceLabel(m.cheapestPer1M)}</td>
                  <td data-label="Served by" className="text-right text-[var(--muted)]">{m.cheapestProvider ?? '\u2014'}</td>
                  <td data-label="Released" className="num text-right">{dateLabel(m.releaseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
