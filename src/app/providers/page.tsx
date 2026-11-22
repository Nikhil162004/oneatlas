import Link from 'next/link';
import { listProviders } from '@/lib/services/catalogue';
import { Empty, StatRow } from '@/components/ui';
import { msLabel, pctLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Providers' };

/** Who serves the models. Price varies per model × provider, which is why this is its own table. */
export default async function ProvidersPage() {
  const { data } = await listProviders(200).catch(() => ({ data: [] }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Providers</h1>
        <p className="text-sm text-[var(--muted)]">Inference providers in the mirrored catalogue, by how many listings they carry.</p>
      </div>
      {!data.length ? (
        <Empty title="No providers mirrored yet" hint="Run npm run ingest:endpoints (or --endpoints with a limit) to fill the listings." />
      ) : (
        <>
          <StatRow items={[['Providers', data.length], ['Listings', data.reduce((a, p) => a + p.listingCount, 0)], ['With a free tier', data.filter((p) => p.freeCount > 0).length]]} />
          <div className="tablewrap">
            <table className="min-w-[860px] text-sm">
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col" className="text-right">Models</th>
                  <th scope="col" className="text-right">Listings</th>
                  <th scope="col" className="text-right">Free</th>
                  <th scope="col" className="text-right">Cheapest in /1M</th>
                  <th scope="col" className="text-right">Avg input /1M</th>
                  <th scope="col" className="text-right">Avg latency p50</th>
                  <th scope="col" className="text-right">Avg uptime 24h</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.slug}>
                    <td className="font-medium">{p.name}{p.website && <a className="ml-1 text-xs text-[var(--muted)] underline" href={p.website} rel="noopener noreferrer" target="_blank" aria-label={`${p.name} website`}>site</a>}</td>
                    <td className="num text-right">{p.modelCount}</td>
                    <td className="num text-right">{p.listingCount}</td>
                    <td className="num text-right">{p.freeCount || '\u2014'}</td>
                    <td className="num text-right">{priceLabel(p.cheapestPromptPer1M)}</td>
                    <td className="num text-right">{priceLabel(p.avgPromptPer1M)}</td>
                    <td className="num text-right">{msLabel(p.avgLatencyMs)}</td>
                    <td className="num text-right">{pctLabel(p.avgUptimePct)}</td>
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
