import Link from 'next/link';
import { notFound } from 'next/navigation';
import { providerDetail } from '@/lib/services/catalogue';
import { Section, StatRow } from '@/components/ui';
import { contextLabel, dateLabel, msLabel, pctLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug };
}

/**
 * Provider profile: what this provider serves and what it charges, model by model. The directory
 * compares providers against each other; this page is the evidence behind one row of it.
 */
export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = await providerDetail(slug).catch(() => null);
  if (!provider) notFound();

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm text-[var(--faint)]">
          <Link className="underline" href="/providers">Providers</Link> / {provider.slug}
        </p>
        <h1 className="mt-2">{provider.name}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Serves {provider.modelCount} of the mirrored models across {provider.listingCount} endpoint
          listings. Prices below are this provider's own cheapest listing per model.{' '}
          <Link className="underline" href={`/models?provider=${provider.slug}`}>Open them in Models</Link>
          {provider.website && (
            <>
              {' · '}
              <a className="underline" href={provider.website} rel="noopener noreferrer" target="_blank">
                {provider.website.replace(/^https?:\/\//, '')}
              </a>
            </>
          )}
        </p>
      </section>

      <StatRow
        items={[
          ['Models served', provider.modelCount],
          ['Listings', provider.listingCount],
          ['Free listings', provider.freeCount],
          ['Cheapest input', priceLabel(provider.cheapestPromptPer1M)],
        ]}
      />

      <section>
        <Section id="reliability" title="Reliability, as mirrored" right={<small>samples are listings with a measurement, not all listings</small>} />
        <p className="num text-sm text-[var(--muted)]">
          Average latency p50 {msLabel(provider.avgLatencyMs)} ({provider.latencySamples} of {provider.listingCount}).
          Average uptime 24h {pctLabel(provider.avgUptimePct)} ({provider.uptimeSamples} of {provider.listingCount}).
          Average input price {priceLabel(provider.avgPromptPer1M)} per 1M.
        </p>
      </section>

      <section>
        <Section id="models" title="Supported models" count={provider.models.length} right={<small>cheapest first</small>} />
        <div className="tablewrap">
          <table className="stack-sm min-w-[860px] text-sm">
            <caption className="sr-only">Models this provider serves, with its cheapest price on each</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col" className="text-right">In per 1M</th>
                <th scope="col" className="text-right">Out per 1M</th>
                <th scope="col" className="text-right">Context</th>
                <th scope="col" className="text-right">Latency p50</th>
                <th scope="col" className="text-right">Uptime 24h</th>
                <th scope="col" className="text-right">Released</th>
              </tr>
            </thead>
            <tbody>
              {provider.models.map((m) => (
                <tr key={m.slug}>
                  <td data-title>
                    <Link className="rowlink font-medium" href={`/models/${m.slug}`}>{m.name}</Link>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--faint)]">
                      <span className="tag">{m.modelType.toLowerCase()}</span>
                      {m.lab}
                      {m.free && <span className="flag flag-quiet">free</span>}
                    </span>
                  </td>
                  <td data-label="In per 1M" className="num text-right">{priceLabel(m.per1M.prompt)}</td>
                  <td data-label="Out per 1M" className="num text-right">{priceLabel(m.per1M.completion)}</td>
                  <td data-label="Context" className="num text-right">{contextLabel(m.contextWindow)}</td>
                  <td data-label="Latency p50" className="num text-right">{msLabel(m.latencyP50Ms)}</td>
                  <td data-label="Uptime 24h" className="num text-right">{pctLabel(m.uptimePct)}</td>
                  <td data-label="Released" className="num text-right text-[var(--muted)]">{dateLabel(m.releaseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
