import Link from 'next/link';
import { changesFeed } from '@/lib/services/catalogue';
import { Empty, Section } from '@/components/ui';
import WatchedDigest from '@/components/WatchedDigest';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Changes' };

/**
 * What moved between mirrors. Every row here was written by the ingest run that overwrote the
 * old value (see lib/ingest/diff), so the feed can name the run and the moment, not just the
 * difference. Empty is a legitimate state: it means the last mirrors found the catalogue as
 * they left it, and the page says so instead of padding the list.
 */
export default async function ChangesPage() {
  const { data, meta } = await changesFeed(100).catch(() => ({ data: [], meta: { limit: 100, total: 0 } }));
  // The feed is chronological; this is the same rows re-ranked by how far a price actually moved.
  const movers = data
    .filter((c) => c.pctChange !== null)
    .sort((a, b) => Math.abs(b.pctChange ?? 0) - Math.abs(a.pctChange ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1>Changes</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Prices, specs and capabilities that moved between catalogue mirrors, newest first.{' '}
          <span className="num">{meta.total} recorded</span> since tracking began. The mirrors run on the schedule shown at{' '}
          <Link className="underline" href="/status">Status</Link>; every event names the run that caused it.
        </p>
      </div>

      <WatchedDigest />

      <section>
        <Section id="rss" title="Follow by RSS" />
        <p className="max-w-[72ch] text-sm leading-relaxed text-[var(--muted)]">
          This page is the readable view of the change feed. A feed reader polls the same events as RSS:
          paste the address below into the reader and new price moves arrive there instead. Every model
          page carries the same arrangement for its own history, linked from its History section.
        </p>
        <p className="snippet num mt-3 overflow-auto">{`${SITE_URL}/changes.xml`}</p>
      </section>

      {movers.length > 0 && (
        <section>
          <Section id="movers" title="Biggest movers" count={movers.length} />
          <ul className="space-y-1.5 text-sm">
            {movers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="num font-medium">{(c.pctChange ?? 0) > 0 ? '+' : ''}{(c.pctChange ?? 0).toFixed(1)}%</span>
                <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${c.modelSlug}`}>{c.modelSlug}</Link>
                <span className="text-[var(--muted)]">{c.field}{c.detail ? ` · ${c.detail}` : ''}</span>
                <span className="num text-[var(--muted)]">{c.oldValue} → {c.newValue}</span>
                <span className="num text-xs text-[var(--faint)]">{new Date(c.at).toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!data.length ? (
        <Empty
          title="No changes recorded yet"
          hint="Events appear when a mirror finds a price or spec different from the one stored. A quiet feed means the catalogue has been stable, not that tracking is off."
        />
      ) : (
        <>
          <Section id="feed" title="Change feed" count={data.length} />
          <div className="tablewrap">
            <table className="stack-sm min-w-[900px] text-sm">
              <caption className="sr-only">Catalogue changes: model, field, old and new value, when, and the ingest run responsible</caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Field</th>
                  <th scope="col">Detail</th>
                  <th scope="col" className="text-right">Was</th>
                  <th scope="col" className="text-right">Now</th>
                  <th scope="col" className="text-right">When</th>
                  <th scope="col">Run</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id}>
                    <td data-title>
                      <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${c.modelSlug}`}>{c.modelSlug}</Link>
                    </td>
                    <td>{c.field}</td>
                    <td className="text-[var(--faint)]">{c.detail ?? '—'}</td>
                    <td className="num text-right">{c.oldValue ?? '—'}</td>
                    <td className="num text-right">{c.newValue ?? '—'}</td>
                    <td className="num text-right">{new Date(c.at).toISOString().slice(0, 16).replace('T', ' ')}</td>
                    <td className="text-[var(--faint)]">{c.source}</td>
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
