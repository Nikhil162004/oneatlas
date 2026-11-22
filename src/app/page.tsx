import Link from 'next/link';
import { getStats } from '@/lib/services/stats';
import { listModels } from '@/lib/services/catalogue';
import { listQuerySchema } from '@/lib/validation';
import { CapabilityTags, Meter, Section } from '@/components/ui';
import { contextLabel, dateLabel, pricePair } from '@/lib/format';

export const dynamic = 'force-dynamic';

const COVERAGE_LABEL: Record<string, string> = {
  reasoning: 'Reasoning',
  tools: 'Tool calling',
  structuredOutput: 'Structured output',
  visionInput: 'Vision input',
  openWeights: 'Open weights',
};

/**
 * The landing surface is the catalogue itself: counts, coverage, what arrived last, what is cheap to
 * run. Every number is a query, so the page is a demo of the API rather than a poster about it.
 */
export default async function Home() {
  // `next build` runs this with no database in reach; a missing number must not fail the build.
  const [stats, cheap] = await Promise.all([
    getStats().catch(() => null),
    listModels({ ...listQuerySchema.parse({}), capabilities: ['tools'], sort: 'priceLow', limit: 6 }).catch(() => ({ data: [] })),
  ]);

  const counters: Array<[string, number | undefined]> = [
    ['Models', stats?.models],
    ['Labs', stats?.labs],
    ['Providers', stats?.providers],
    ['API listings', stats?.listings],
  ];
  const maxScored = Math.max(1, ...(stats?.benchmarks.map((b) => b.scored) ?? [1]));

  return (
    <div className="space-y-12">
      <section className="grid items-end gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <h1 className="max-w-[22ch]">
            Every AI model on the public catalogue, with who serves it and what each charges.
          </h1>
          <p className="lede mt-4">
            One Postgres mirror of OpenRouter&apos;s model list and its per-provider endpoints: context, price,
            capabilities, latency and benchmark scores, filterable and sortable, with a JSON API over the
            same tables.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link className="btn btn-primary" href="/models">Browse models</Link>
            <Link className="btn" href="/rankings">Rankings</Link>
            <Link className="btn" href="/compare">Compare two</Link>
            <Link className="btn" href="/api/models">Get the JSON</Link>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2">
          {counters.map(([label, value]) => (
            <div key={label} className="card card-tight">
              <dt className="label">{label}</dt>
              <dd className="num mt-1 text-[34px] leading-none">{value ?? '\u2014'}</dd>
            </div>
          ))}
        </dl>
      </section>

      {stats && (
        <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <Section id="coverage" title="What the catalogue supports" />
            <ul className="space-y-2" aria-labelledby="coverage">
              {(Object.entries(stats.coverage) as Array<[string, number]>).map(([key, pct]) => (
                <li key={key} className="rowline">
                  <span className="text-sm">{COVERAGE_LABEL[key]}</span>
                  <span className="flex w-40 items-center gap-3">
                    <span className="flex-1">
                      <Meter value={pct} />
                    </span>
                    <span className="num w-10 text-right text-sm">{pct}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Section id="scored" title="Benchmark coverage" right={<small>{stats.benchmarks.length} tracked</small>} />
            <ul className="space-y-2" aria-labelledby="scored">
              {stats.benchmarks.map((b) => (
                <li key={b.name} className="rowline">
                  <span className="text-sm">{b.name}</span>
                  <span className="flex w-40 items-center gap-3">
                    <span className="flex-1">
                      <Meter value={b.scored} max={maxScored} />
                    </span>
                    <span className="num w-10 text-right text-sm">{b.scored}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {cheap?.data.length ? (
        <section>
          <Section
            id="cheap"
            title="Cheapest that still calls tools"
            right={<Link className="text-sm underline" href="/models?capabilities=tools&sort=priceLow">all tool-capable models</Link>}
          />
          <div className="tablewrap">
            <table className="text-sm">
              <caption className="sr-only">Tool-capable models ordered by the cheapest provider input price</caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Capabilities</th>
                  <th scope="col" className="text-right">Context</th>
                  <th scope="col" className="text-right">In / out per 1M</th>
                </tr>
              </thead>
              <tbody>
                {cheap.data.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link className="font-medium" href={`/models/${m.slug}`}>{m.name}</Link>
                      <span className="block text-xs text-[var(--faint)]">{m.lab.name}</span>
                    </td>
                    <td><CapabilityTags caps={m.capabilities} /></td>
                    <td className="num text-right">{contextLabel(m.contextWindow)}</td>
                    <td className="num text-right">{pricePair(m.pricing.per1M.prompt, m.pricing.per1M.completion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {stats?.latest.length ? (
        <section>
          <Section id="latest" title="Most recently released" right={<Link className="text-sm underline" href="/models?sort=released">next 25</Link>} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {stats.latest.map((m) => (
              <li key={m.slug}>
                <Link href={`/models/${m.slug}`} className="card card-hover block">
                  <span className="block font-medium leading-snug">{m.name}</span>
                  <span className="mt-1 block text-xs text-[var(--faint)]">
                    {m.lab.name} <span className="num">· {dateLabel(m.releaseDate)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
