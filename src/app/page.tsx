import Link from 'next/link';
import { getStats, type Stats } from '@/lib/services/stats';

export const dynamic = 'force-dynamic';

/**
 * Placeholder home. The point of it is the path the numbers take: the database, through
 * lib/services, into a server component. Replace this screen with the hero + coverage bars in
 * docs/ui-brief.md — the API layer needs nothing for that to work.
 */
const COVERAGE_LABEL: Record<keyof Stats['coverage'], string> = {
  reasoning: 'Reasoning',
  tools: 'Tool calling',
  structuredOutput: 'Structured output',
  visionInput: 'Vision input',
  openWeights: 'Open weights',
};

export default async function Home() {
  // `next build` runs this with no database in reach. A missing number renders as an em dash
  // rather than failing the build.
  const stats: Stats | null = await getStats().catch(() => null);
  const counters: Array<[string, number | undefined]> = [
    ['Models', stats?.models],
    ['Labs', stats?.labs],
    ['Providers', stats?.providers],
    ['API listings', stats?.listings],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Every AI model, compared.</h1>
      <p className="max-w-prose text-[var(--muted)]">
        Specs, pricing, capabilities and providers in one place. Sort any column, filter to what you
        need, and open a model for the full record.
      </p>
      <dl className="flex flex-wrap gap-6 text-sm">
        {counters.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[var(--muted)]">{label}</dt>
            <dd className="num text-2xl">{value ?? '\u2014'}</dd>
          </div>
        ))}
      </dl>
      {stats && (
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5" aria-label="Capability coverage">
          {(Object.entries(stats.coverage) as Array<[keyof Stats['coverage'], number]>).map(([key, pct]) => (
            <li key={key} className="flex items-center justify-between gap-3 border border-[var(--line)] px-3 py-2">
              <span className="text-[var(--muted)]">{COVERAGE_LABEL[key]}</span>
              <span className="num">{pct}%</span>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link className="underline" href="/models">Browse models</Link>
      </p>
    </div>
  );
}
