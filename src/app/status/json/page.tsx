import Link from 'next/link';
import { ingestStatus } from '@/lib/services/catalogue';
import { SITE_URL } from '@/lib/site';
import { Notice, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'API status (JSON)' };

/**
 * GET /api/status, readable. The endpoint answers the envelope as raw JSON for scripts that
 * poll it, and this page renders the same {data, meta} object for a human who clicked the
 * footer link in a browser that would otherwise download the file. The human tables for the
 * same facts are one level up, at /status.
 */
export default async function StatusJsonPage() {
  const result = await ingestStatus().catch(() => null);
  return (
    <div className="space-y-6">
      <div>
        <h1>API status (JSON)</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Exactly what <span className="num">GET /api/status</span> answers, pretty-printed. Scripts poll the
          endpoint itself: <a className="underline" href={`${SITE_URL}/api/status`}>raw JSON</a>. The same facts
          as tables: <Link className="underline" href="/status">ingest status</Link>.
        </p>
      </div>
      {!result ? (
        <Notice>Live counts could not be read just now; the endpoint reports its own error to scripts.</Notice>
      ) : (
        <section>
          <Section id="envelope" title="Envelope" />
          <pre className="snippet overflow-auto">{JSON.stringify({ data: result.data, meta: result.meta }, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
