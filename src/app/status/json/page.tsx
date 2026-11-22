import Link from 'next/link';
import { ingestStatus } from '@/lib/services/catalogue';
import { SITE_URL } from '@/lib/site';
import { Notice, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'API status (JSON)' };

/**
 * GET /api/status with a human face. The endpoint answers the envelope as raw JSON for
 * scripts that poll it; a browser sent to the bare URL may download the file instead of
 * showing it, so the footer's link lands here: the headline numbers as readable stats,
 * then the exact {data, meta} object for anyone who wants the payload itself. The ingest
 * runs behind these numbers are tabulated at /status.
 */
export default async function StatusJsonPage() {
  const result = await ingestStatus().catch(() => null);
  const d = result?.data;
  const stats: Array<[string, string]> = d
    ? [
        ['Models mirrored', String(d.counts.models)],
        ['Provider listings', String(d.counts.listings)],
        ['Changes recorded', String(d.counts.changes)],
        ['Changes, last 7 days', String(d.counts.changesLast7d)],
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1>API status (JSON)</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          What <span className="num">GET /api/status</span> answers, readable. Scripts poll the endpoint itself:{' '}
          <a className="underline" href={`${SITE_URL}/api/status`}>raw JSON</a>. The runs behind these numbers:{' '}
          <Link className="underline" href="/status">ingest status</Link>.
        </p>
      </div>

      {!result || !d ? (
        <Notice>Live counts could not be read just now; the endpoint reports its own error to scripts.</Notice>
      ) : (
        <>
          <section>
            <Section id="headline" title="Headline" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map(([label, value]) => (
                <div key={label} className="card card-tight">
                  <p className="num text-2xl font-medium">{value}</p>
                  <p className="mt-1 text-xs text-[var(--faint)]">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Last successful mirror:{' '}
              <span className="num">
                {d.lastSuccessAt
                  ? `${new Date(d.lastSuccessAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`
                  : 'none recorded'}
              </span>
              . Schedule: <span className="num">{d.schedule}</span>.
            </p>
          </section>

          <section>
            <Section id="envelope" title="The envelope, exactly as served" />
            <pre className="snippet overflow-auto">{JSON.stringify({ data: result.data, meta: result.meta }, null, 2)}</pre>
          </section>
        </>
      )}
    </div>
  );
}
