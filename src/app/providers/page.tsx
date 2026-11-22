import Link from 'next/link';
import { listProviders } from '@/lib/services/catalogue';
import { Empty, Section } from '@/components/ui';
import { msLabel, pctLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Providers' };

/**
 * Who serves the catalogue, and how far apart their prices are. The spread bar is the point of this
 * screen: one model can cost 40x more on one endpoint than another, and a single average hides that.
 */
export default async function ProvidersPage() {
  const { data, meta } = await listProviders(200).catch(() => ({ data: [], meta: { limit: 0, catalogueOnlyListings: 0 } }));
  const ceiling = Math.max(1, ...data.map((p) => p.dearestPromptPer1M ?? 0));
  const scale = (v: number | null) => `${Math.round(((v ?? 0) / ceiling) * 100)}%`;

  return (
    <div className="space-y-6">
      <div>
        <h1>Providers</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Providers with at least one mirrored endpoint listing, by how many they carry.{' '}
          {meta.catalogueOnlyListings > 0 && (
            <span className="num">{meta.catalogueOnlyListings} catalogue-level prices</span>
          )}
          {meta.catalogueOnlyListings > 0 && ' are a model\'s own listed price with no endpoint behind them, so they are not counted as a provider here.'}
        </p>
      </div>

      {!data.length ? (
        <Empty title="No providers mirrored yet" hint="Run npm run ingest with --endpoints to fill the listings." />
      ) : (
        <>
          <Section id="table" title="Price and performance" count={data.length} />
          <div className="tablewrap">
            <table className="stack-sm min-w-[1000px] text-sm">
              <caption className="sr-only">Providers with listing counts, price range, latency and uptime</caption>
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col" className="text-right">Models</th>
                  <th scope="col" className="text-right">Listings</th>
                  <th scope="col" className="text-right">Free</th>
                  <th scope="col" className="text-right">Cheapest input</th>
                  <th scope="col" className="text-right">Average input</th>
                  <th scope="col" className="text-right">Dearest input</th>
                  <th scope="col" className="w-32">Spread</th>
                  <th scope="col" className="text-right">Avg latency p50</th>
                  <th scope="col" className="text-right">Avg uptime 24h</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.slug}>
                    <td data-title>
                      <span className="font-medium">{p.name}</span>
                      <Link className="ml-2 text-xs text-[var(--faint)] underline" href={`/models?provider=${p.slug}`} aria-label={`models served by ${p.name}`}>
                        models
                      </Link>
                      {p.website && (
                        <a className="ml-2 text-xs text-[var(--faint)] underline" href={p.website} rel="noopener noreferrer" target="_blank" aria-label={`${p.name} website`}>
                          site
                        </a>
                      )}
                    </td>
                    <td data-label="Models" className="num text-right">{p.modelCount}</td>
                    <td data-label="Listings" className="num text-right">{p.listingCount}</td>
                    <td data-label="Free" className="num text-right">{p.freeCount || '\u2014'}</td>
                    <td data-label="Cheapest input" className="num text-right">{priceLabel(p.cheapestPromptPer1M)}</td>
                    <td data-label="Average input" className="num text-right text-[var(--muted)]">{priceLabel(p.avgPromptPer1M)}</td>
                    <td data-label="Dearest input" className="num text-right">{priceLabel(p.dearestPromptPer1M)}</td>
                    <td data-label="Spread">
                      <span
                        className="spread block"
                        style={{ '--from': scale(p.cheapestPromptPer1M), '--to': scale(p.dearestPromptPer1M), '--avg': scale(p.avgPromptPer1M) } as React.CSSProperties}
                        title={`cheapest ${priceLabel(p.cheapestPromptPer1M)}, average ${priceLabel(p.avgPromptPer1M)}, dearest ${priceLabel(p.dearestPromptPer1M)}`}
                      />
                    </td>
                    <td data-label="Avg latency p50" className="num text-right">
                      {msLabel(p.avgLatencyMs)}
                      <span className="block text-[11px] text-[var(--faint)]">{p.latencySamples} of {p.listingCount}</span>
                    </td>
                    <td data-label="Avg uptime 24h" className="num text-right">
                      {pctLabel(p.avgUptimePct)}
                      <span className="block text-[11px] text-[var(--faint)]">{p.uptimeSamples} of {p.listingCount}</span>
                    </td>
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
