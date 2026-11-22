import Link from 'next/link';
import { notFound } from 'next/navigation';
import { modelDetail } from '@/lib/services/catalogue';
import { slugParamSchema } from '@/lib/validation';
import { CapabilityTags, Meter, Section, StatRow } from '@/components/ui';
import { contextLabel, dateLabel, msLabel, pctLabel, priceLabel } from '@/lib/format';

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

  const best = model.providers[0];
  const modalities = [
    ...(model.inputModalities ?? []).map((m) => `in: ${m}`),
    ...(model.outputModalities ?? []).map((m) => `out: ${m}`),
  ];

  return (
    <div className="space-y-12">
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
        </div>

        <div className="card">
          <p className="label">Cheapest listing</p>
          <p className="num mt-2 text-[34px] leading-none">
            {priceLabel(best?.per1M.prompt ?? null)}
            <span className="text-[18px] text-[var(--muted)]"> / {priceLabel(best?.per1M.completion ?? null)}</span>
          </p>
          <p className="mt-1 text-xs text-[var(--faint)]">
            per 1M tokens, in / out{best ? ` via ${best.provider.name}` : ''}
          </p>
          <div className="mt-4 space-y-2">
            {[
              ['Context', contextLabel(model.contextWindow)],
              ['Max output', contextLabel(model.maxOutputTokens)],
              ['Providers', model.providers.length || '\u2014'],
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
        <Section id="providers-h" title="Providers" count={model.providers.length} />
        {/* The anchor outlives the empty state: /models/x/y#providers is a link people paste. */}
        {model.providers.length ? (
          <div className="tablewrap">
            <table className="min-w-[980px] text-sm">
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
                {model.providers.map((p, i) => (
                  <tr key={`${p.provider.slug}-${p.endpoint}-${i}`}>
                    <td>
                      <span className="font-medium">{p.provider.name}</span>
                      <span className="block text-xs text-[var(--faint)]">{p.endpoint}</span>
                      {i === 0 && p.per1M.prompt !== null && <span className="flag mt-1">cheapest</span>}
                      {p.free && <span className="flag flag-quiet mt-1 ml-1">free</span>}
                    </td>
                    <td className="num text-right">{priceLabel(p.per1M.prompt)}</td>
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
          <p className="card card-tight text-sm text-[var(--muted)]">
            No provider endpoint mirrored for this model. Its specs come from the catalogue entry; the
            listing endpoints returned nothing.
          </p>
        )}
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

      <p className="text-sm text-[var(--faint)]">
        This page and <Link className="underline" href={`/api/models/${model.slug}`}>/api/models/{model.slug}</Link> read the same
        service, so they cannot disagree.
      </p>
    </div>
  );
}
