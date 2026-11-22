import { ingestStatus } from '@/lib/services/catalogue';
import { Empty, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Status' };

/**
 * Is the data alive? The catalogue refreshes itself daily (Vercel Cron → POST mirror → IngestRun
 * row), and this screen reads those rows: when the last mirror succeeded, what it wrote, and how
 * much has moved since. It exists so "the data might be stale" is a checkable fact with a date
 * attached, not a suspicion — the same rows are at GET /api/status.
 */
export default async function StatusPage() {
  const { data } = await ingestStatus().catch(() => ({
    data: { counts: { models: 0, listings: 0, changes: 0, changesLast7d: 0 }, lastSuccessAt: null, schedule: '', runs: [] },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1>Status</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ingest health for the mirrored catalogue. Refresh schedule: <span className="num">{data.schedule}</span>.
          Last successful mirror:{' '}
          <span className="num">{data.lastSuccessAt ? new Date(data.lastSuccessAt).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'none recorded'}</span>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {([
          ['Models mirrored', data.counts.models],
          ['Listings mirrored', data.counts.listings],
          ['Changes recorded', data.counts.changes],
          ['Changes, last 7 days', data.counts.changesLast7d],
        ] as const).map(([label, v]) => (
          <div key={label} className="card">
            <div className="num text-2xl">{v.toLocaleString('en-US')}</div>
            <div className="mt-1 text-xs text-[var(--faint)]">{label}</div>
          </div>
        ))}
      </div>

      {!data.runs.length ? (
        <Empty title="No ingest runs recorded" hint="Run npm run ingest, or POST /api/admin/ingest with the ingest token." />
      ) : (
        <>
          <Section id="runs" title="Recent ingest runs" count={data.runs.length} />
          <div className="tablewrap">
            <table className="stack-sm min-w-[900px] text-sm">
              <caption className="sr-only">Recent ingest runs: when, source, status, rows written, changes detected, duration</caption>
              <thead>
                <tr>
                  <th scope="col">Started (UTC)</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Models</th>
                  <th scope="col" className="text-right">Listings</th>
                  <th scope="col" className="text-right">Skipped</th>
                  <th scope="col" className="text-right">Changes</th>
                  <th scope="col" className="text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.id}>
                    <td data-title className="num">{new Date(r.startedAt).toISOString().slice(0, 16).replace('T', ' ')}</td>
                    <td>{r.source}</td>
                    <td>{r.status === 'success' ? <span className="flag">success</span> : <span className="flag flag-quiet">{r.status}</span>}</td>
                    <td className="num text-right">{r.modelsUp.toLocaleString('en-US')}</td>
                    <td className="num text-right">{r.listingsUp.toLocaleString('en-US')}</td>
                    <td className="num text-right">{r.skipped}</td>
                    <td className="num text-right">{r.changes}</td>
                    <td className="num text-right">{r.durationMs === null ? '—' : `${(r.durationMs / 1000).toFixed(1)}s`}</td>
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
