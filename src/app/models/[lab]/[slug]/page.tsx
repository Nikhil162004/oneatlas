import Link from 'next/link';
import { notFound } from 'next/navigation';
import { modelDetail, modelHistory, similarModels } from '@/lib/services/catalogue';
import { slugParamSchema } from '@/lib/validation';
import { CapabilityTags, Meter, Section, StatRow } from '@/components/ui';
import CostEstimator from '@/components/CostEstimator';
import { AddToCompare } from '@/components/tray';
import { WatchButton } from '@/components/watchlist';
import SnippetTabs from '@/components/SnippetTabs';
import { contextLabel, dateLabel, msLabel, pctLabel, priceLabel, pricePair } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lab: string; slug: string }> }) {
  const { lab, slug } = await params;
  const model = await modelDetail(lab, slug).catch(() => null);
  if (!model) return { title: 'Model' };
  return { title: model.name, description: model.description?.slice(0, 160) ?? undefined };
}

/**
 * The record for one model, and the per-provider listings that make the catalogue worth mirroring:
 * the same model is a different price, context window and speed depending on who serves it.
 */
export default async function ModelPage({ params }: { params: Promise<{ lab: string; slug: string }> }) {
  const routeParams = await params;
  const parsed = slugParamSchema.safeParse(routeParams);
  if (!parsed.success) notFound();

  const model = await modelDetail(parsed.data.lab, parsed.data.slug);
  if (!model) notFound();

  // Provenance is a column, so the page can tell an offer from a listed price. A model mirrored
  // without its endpoint records has a price and no provider; claiming the latter would be invented.
  const endpoints = model.providers.filter((x) => x.fromEndpoint);
  const catalogue = model.providers.find((x) => !x.fromEndpoint) ?? null;
  const best = endpoints[0] ?? catalogue ?? null;
  // The estimator prices endpoint listings; a catalogue-only model gets its listed rate,
  // labelled as what it is rather than dressed up as a provider offer.
  const costListings = endpoints.length
    ? endpoints.map((p) => ({ provider: p.provider.name, prompt: p.per1M.prompt, completion: p.per1M.completion, free: p.free }))
    : catalogue
      ? [{ provider: 'Catalogue listing (not a provider offer)', prompt: catalogue.per1M.prompt, completion: catalogue.per1M.completion, free: catalogue.free }]
      : [];
  const similar = await similarModels(parsed.data.lab, parsed.data.slug).catch(() => null);
  const history = await modelHistory(parsed.data.lab, parsed.data.slug).catch(() => null);
  // The price trend is drawn from the recorded moves themselves (Batch C events), oldest first,
  // seeded with the first event's old value so the line starts where the price actually was.
  const priceSeries = (history?.data ?? [])
    .filter((h) => h.field === 'input price' && h.newValue !== null && Number.isFinite(Number(h.newValue)))
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
  const series: number[] = priceSeries.length
    ? [
        priceSeries[0]!.oldValue !== null && Number.isFinite(Number(priceSeries[0]!.oldValue))
          ? Number(priceSeries[0]!.oldValue)
          : Number(priceSeries[0]!.newValue),
        ...priceSeries.map((h) => Number(h.newValue)),
      ]
    : [];
  const sparkMin = series.length ? Math.min(...series) : 0;
  const sparkMax = series.length ? Math.max(...series) : 0;
  const sparkSpan = sparkMax - sparkMin || 1;
  const sparkPoints = series.map((v, i) => `${2 + (i / (series.length - 1)) * 296},${58 - ((v - sparkMin) / sparkSpan) * 52}`).join(' ');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: model.name,
    description: model.description?.slice(0, 300) ?? undefined,
    brand: { '@type': 'Organization', name: model.lab.name },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Context window (tokens)', value: model.contextWindow },
      ...(best?.per1M.prompt !== null && best?.per1M.prompt !== undefined
        ? [{ '@type': 'PropertyValue', name: 'Cheapest input price (USD per 1M tokens)', value: best.per1M.prompt }]
        : []),
    ],
  };
  const modalities = [
    ...(model.inputModalities ?? []).map((m) => `in: ${m}`),
    ...(model.outputModalities ?? []).map((m) => `out: ${m}`),
  ];

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm text-[var(--faint)]">
            <Link className="underline" href="/models">Models</Link>
            {' / '}
            <Link className="underline" href={`/labs/${model.lab.slug}`}>{model.lab.name}</Link>
          </p>
          <h1 className="mt-2">{model.name}</h1>
          <p className="num mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span className="tag">{model.slug}</span>
            <span className="tag">{model.modelType.toLowerCase()}</span>
            <span>{dateLabel(model.releaseDate)}</span>
            {model.deprecatedAt && <span className="flag flag-warn">deprecated {dateLabel(model.deprecatedAt)}</span>}
          </p>
          {model.description && <p className="lede mt-4">{model.description.slice(0, 700)}</p>}
          <p className="mt-4"><CapabilityTags caps={model.capabilities} /></p>
          <p className="mt-4 flex flex-wrap gap-2">
            <AddToCompare slug={model.slug} name={model.name} />
            <WatchButton slug={model.slug} name={model.name} />
          </p>
        </div>

        <div className="card">
          <p className="label">Cheapest listing</p>
          <p className="num mt-2 text-[34px] leading-none">
            {priceLabel(best?.per1M.prompt ?? null)}
            <span className="text-[18px] text-[var(--muted)]"> / {priceLabel(best?.per1M.completion ?? null)}</span>
          </p>
          <p className="mt-1 text-xs text-[var(--faint)]">
            per 1M tokens, in / out{best ? (best.fromEndpoint ? ` via ${best.provider.name}` : ' as listed in the catalogue') : ''}
          </p>
          <div className="mt-4 space-y-2">
            {[
              ['Context', contextLabel(model.contextWindow)],
              ['Max output', contextLabel(model.maxOutputTokens)],
              ['Providers', endpoints.length ? `${endpoints.length}${catalogue ? '' : ''}` : '\u2014'],
              ['Modalities', modalities.length ? modalities.join(', ') : '\u2014'],
            ].map(([label, value]) => (
              <p key={label as string} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-[var(--faint)]">{label}</span>
                <span className="num text-right">{value}</span>
              </p>
            ))}
          </div>
          <p className="mt-4 text-xs">
            <Link className="underline text-[var(--muted)]" href={`/compare?ids=${model.slug}`}>Compare this model</Link>
          </p>
        </div>
      </section>

      <section id="providers" className="scroll-mt-20">
        {/* The anchor outlives the empty state: /models/x/y#providers is a link people paste. */}
        <Section id="providers-h" title="Provider endpoints" count={endpoints.length} />
        {endpoints.length ? (
          <div className="tablewrap">
            <table className="stack-sm min-w-[980px] text-sm">
              <caption className="sr-only">Every provider endpoint serving this model, cheapest first</caption>
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col" className="text-right">In per 1M</th>
                  <th scope="col" className="text-right">Out per 1M</th>
                  <th scope="col" className="text-right">Cache read</th>
                  <th scope="col" className="text-right">Context</th>
                  <th scope="col" className="text-right">Latency p50</th>
                  <th scope="col" className="text-right">Uptime 24h</th>
                  <th scope="col">Quantisation</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((p, i) => (
                  <tr key={`${p.provider.slug}-${p.endpoint}-${i}`}>
                    <td data-title>
                      <span className="font-medium">{p.provider.name}</span>
                      <span className="block text-xs text-[var(--faint)]">{p.endpoint}</span>
                      {i === 0 && p.per1M.prompt !== null && <span className="flag mt-1">cheapest</span>}
                      {p.free && <span className="flag flag-quiet mt-1 ml-1">free</span>}
                    </td>
                    <td data-label="In per 1M" className="num text-right">{priceLabel(p.per1M.prompt)}</td>
                    <td data-label="Out per 1M" className="num text-right">{priceLabel(p.per1M.completion)}</td>
                    <td data-label="Cache read" className="num text-right">{priceLabel(p.per1M.cacheRead)}</td>
                    <td data-label="Context" className="num text-right">{contextLabel(p.contextWindow)}</td>
                    <td data-label="Latency p50" className="num text-right">{msLabel(p.latencyP50Ms)}</td>
                    <td data-label="Uptime 24h" className="num text-right">{pctLabel(p.uptimePct)}</td>
                    <td data-label="Quantisation" className="text-[var(--muted)]">{p.quantization ?? '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card card-tight text-sm text-[var(--muted)]">
            No endpoint mirrored for this model. Its price and context come from the catalogue entry
            below, which is a listing price rather than an offer from anybody.
          </p>
        )}
        {catalogue && (
          <p className="num mt-2 flex flex-wrap items-baseline gap-x-3 text-xs text-[var(--faint)]">
            <span>Catalogue price, not an offer from a provider</span>
            <span>{pricePair(catalogue.per1M.prompt, catalogue.per1M.completion)} per 1M</span>
            <span>context {contextLabel(catalogue.contextWindow)}</span>
            {catalogue.free && <span className="tag tag-on">free</span>}
          </p>
        )}
      </section>

      <section>
        <Section id="cost" title="Estimate the bill" right={<small>rates from the listings above, re-ranked as you type</small>} />
        <CostEstimator listings={costListings} />
      </section>

      {model.benchmarks.length > 0 && (
        <section>
          <Section id="bench" title="Benchmarks" count={model.benchmarks.length} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {model.benchmarks.map((b) => (
              <li key={b.benchmark.slug} className="card card-tight">
                <p className="text-sm leading-snug">{b.benchmark.name}</p>
                <p className="num mt-2 text-[24px] leading-none">
                  {b.score.toFixed(1)}
                  <span className="ml-1 text-[13px] text-[var(--faint)]">{b.benchmark.unit}</span>
                </p>
                <p className="mt-2"><Meter value={b.score} max={100} /></p>
                <p className="mt-2 text-xs text-[var(--faint)]">{b.benchmark.category}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {similar && similar.data.length > 0 && (
        <section>
          <Section id="alternatives" title="Alternatives" count={similar.data.length} right={<small>same type, shared capabilities, cheapest first</small>} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {similar.data.map((a) => (
              <li key={a.slug} className="card card-tight">
                <Link className="font-medium leading-snug" href={`/models/${a.slug}`}>{a.name}</Link>
                <p className="num mt-1 text-xs text-[var(--faint)]">
                  {a.lab.name} · {contextLabel(a.contextWindow)} context · {priceLabel(a.cheapestPromptPer1M)} in per 1M
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="tag">{a.sharedCapabilities} shared capabilities</span>
                  <Link className="underline text-[var(--muted)]" href={`/compare?ids=${model.slug},${a.slug}`}>Compare</Link>
                  <AddToCompare slug={a.slug} name={a.name} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history && (
        <section>
          <Section id="history" title="History" count={history.data.length} right={<small>recorded by the mirrors, newest first · <a className="underline" href={`${process.env.SITE_URL ?? 'https://oneatlas-smoky.vercel.app'}/models/${model.slug}/feed.xml`}>follow via RSS</a></small>} />
          {priceSeries.length >= 2 && (
            <div className="card card-tight mb-4">
              <p className="label">Input price across {priceSeries.length - 1} recorded {priceSeries.length === 2 ? 'change' : 'changes'}</p>
              <svg viewBox="0 0 300 64" className="mt-2 w-full" role="img" aria-label={`Input price moved from ${series[0]} to ${series[series.length - 1]} across recorded changes`}>
                <polyline points={sparkPoints} fill="none" stroke="var(--accent)" strokeWidth="2" />
                {series.map((v, i) => (
                  <circle key={i} cx={2 + (i / (series.length - 1)) * 296} cy={58 - ((v - sparkMin) / sparkSpan) * 52} r="2.5" fill="var(--accent)" />
                ))}
              </svg>
              <p className="num mt-1 flex justify-between text-xs text-[var(--faint)]">
                <span>low {priceLabel(sparkMin)}</span>
                <span>now {priceLabel(series[series.length - 1] ?? null)}</span>
                <span>high {priceLabel(sparkMax)}</span>
              </p>
            </div>
          )}
          {history.data.length ? (
            <ul className="space-y-1.5 text-sm">
              {history.data.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="num text-xs text-[var(--faint)]">{new Date(h.at).toISOString().slice(0, 10)}</span>
                  <span className="font-medium">{h.field}</span>
                  {h.detail && <span className="text-xs text-[var(--faint)]">{h.detail}</span>}
                  <span className="num text-[var(--muted)]">{h.oldValue ?? '—'} → {h.newValue ?? '—'}</span>
                  {h.pctChange !== null && (
                    <span className="num text-xs text-[var(--faint)]">({h.pctChange > 0 ? '+' : ''}{h.pctChange.toFixed(1)}%)</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--faint)]">
              No changes recorded for this model yet. Tracking began with the change feed at{' '}
              <Link className="underline" href="/changes">/changes</Link>; a quiet history means every mirror since has found this record as it left it.
            </p>
          )}
        </section>
      )}

      <section>
        <Section id="use-api" title="Use via API" right={<small>this record, as JSON</small>} />
        <SnippetTabs path={`/api/models/${model.slug}`} />
        <p className="mt-2 text-xs text-[var(--faint)]">
          One of the read routes; the whole surface is documented at <Link className="underline" href="/api">/api</Link>.
        </p>
      </section>

      {/* The same object, serialised, where a reader can actually see it. Raw JSON is a document and
          some contexts will not paint one; this page already called the service the endpoint calls,
          so what is below is not a paraphrase of the response - it is the response's `data`. */}
      <details className="card card-tight">
        <summary className="cursor-pointer text-sm">
          This record as JSON
          <span className="num ml-2 text-xs text-[var(--faint)]">
            GET /api/models/{model.slug}
          </span>
        </summary>
        <pre className="code mt-3">{JSON.stringify(model, null, 2)}</pre>
      </details>
    </div>
  );
}
