import Link from 'next/link';
import { notFound } from 'next/navigation';
import { modelDetail } from '@/lib/services/catalogue';
import { slugParamSchema } from '@/lib/validation';
import { CapabilityBadges, StatRow } from '@/components/ui';
import { contextLabel, dateLabel, msLabel, pctLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ lab: string; slug: string }> }) {
  const { lab, slug } = await params;
  const model = await modelDetail(lab, slug).catch(() => null);
  if (!model) return { title: 'Model' };
  return { title: model.name, description: model.description?.slice(0, 160) ?? undefined };
}

/**
 * Model detail, including the per-provider listings — the fact the brief singles out. No data is
 * fetched from the browser: the whole page is one server render over the same service the API uses.
 */
export default async function ModelPage({ params }: { params: Promise<{ lab: string; slug: string }> }) {
  const routeParams = await params;
  const parsed = slugParamSchema.safeParse(routeParams);
  if (!parsed.success) notFound();

  const model = await modelDetail(parsed.data.lab, parsed.data.slug);
  if (!model) notFound();

  const capOn = Object.entries(model.capabilities).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]">
          <Link className="underline" href="/models">Models</Link> / <Link className="underline" href={`/labs/${model.lab.slug}`}>{model.lab.name}</Link>
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{model.name}</h1>
        <p className="num mt-1 text-sm text-[var(--muted)]">{model.slug} · {model.modelType.toLowerCase()} · released {dateLabel(model.releaseDate)}{model.deprecatedAt && ` · deprecated ${dateLabel(model.deprecatedAt)}`}</p>
      </div>

      <StatRow
        items={[
          ['Context', contextLabel(model.contextWindow)],
          ['Max output', contextLabel(model.maxOutputTokens)],
          ['Providers serving it', model.providers.length || '\u2014'],
          ['Cheapest input / 1M', priceLabel(model.providers[0]?.per1M.prompt ?? null)],
        ]}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[var(--muted)]">Capabilities</span>
        <CapabilityBadges caps={model.capabilities} short={false} />
        {!capOn.length && <span className="text-[var(--muted)]">none recorded</span>}
      </div>

      {model.description && (
        <p className="max-w-prose whitespace-pre-line text-[var(--muted)]">{model.description.slice(0, 1200)}</p>
      )}

      <section aria-labelledby="listings">
        <h2 id="listings" className="mb-2 text-lg font-semibold">Providers <span className="num text-sm text-[var(--muted)]">{model.providers.length}</span></h2>
        {model.providers.length ? (
          <div className="tablewrap">
            <table className="min-w-[1000px] text-sm">
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">Endpoint</th>
                  <th scope="col" className="text-right">In /1M</th>
                  <th scope="col" className="text-right">Out /1M</th>
                  <th scope="col" className="text-right">Cache read</th>
                  <th scope="col" className="text-right">Context</th>
                  <th scope="col" className="text-right">Latency p50</th>
                  <th scope="col" className="text-right">Uptime 24h</th>
                  <th scope="col">Quant</th>
                </tr>
              </thead>
              <tbody>
                {model.providers.map((p, i) => (
                  <tr key={`${p.provider.slug}-${p.endpoint}-${i}`}>
                    <td className="font-medium">{p.provider.name}</td>
                    <td className="text-[var(--muted)]">{p.endpoint}</td>
                    <td className="num text-right">{priceLabel(p.per1M.prompt)}{i === 0 && p.per1M.prompt !== null && <span className="ml-1 text-[11px] text-[var(--accent)]">cheapest</span>}</td>
                    <td className="num text-right">{priceLabel(p.per1M.completion)}</td>
                    <td className="num text-right">{priceLabel(p.per1M.cacheRead)}</td>
                    <td className="num text-right">{contextLabel(p.contextWindow)}</td>
                    <td className="num text-right">{msLabel(p.latencyP50Ms)}</td>
                    <td className="num text-right">{pctLabel(p.uptimePct)}</td>
                    <td className="text-[var(--muted)]">{p.quantization ?? '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No provider listing for this model yet — the catalogue entry has specs but nobody serving it has been mirrored.</p>
        )}
      </section>

      {model.benchmarks.length > 0 && (
        <section aria-labelledby="bench">
          <h2 id="bench" className="mb-2 text-lg font-semibold">Benchmarks</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {model.benchmarks.map((b) => (
              <li key={b.benchmark.slug} className="card">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{b.benchmark.name}</p>
                <p className="num text-xl">{b.score.toFixed(1)}<span className="ml-1 text-xs text-[var(--muted)]">{b.benchmark.unit}</span></p>
                <p className="text-xs text-[var(--faint)]">{b.benchmark.category}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-[var(--muted)]">
        Same record as JSON: <Link className="underline" href={`/api/models/${model.slug}`}>/api/models/{model.slug}</Link>
      </p>
    </div>
  );
}
