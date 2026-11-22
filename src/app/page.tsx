import Link from 'next/link';

/**
 * Placeholder home. Kept to the minimum that proves the pipeline is wired end to end: a server
 * component reading the API layer through the same code path a browser would take.
 * Replace this screen with the hero + coverage bars described in docs/ui-brief.md.
 */
type Stats = { models: number; labs: number; providers: number; listings: number };

export default async function Home() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  // Build time has no database. A missing number renders as an em dash, not a thrown page.
  const stats: Stats | null = await fetch(`${base}/api/stats`, { cache: 'no-store' })
    .then(async (r) => (r.ok ? ((await r.json()) as { data: Stats }).data : null))
    .catch(() => null);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Every AI model, compared.</h1>
      <p className="max-w-prose text-[var(--muted)]">
        Specs, pricing, capabilities and providers in one place. Sort any column, filter to what you
        need, and open a model for the full record.
      </p>
      <dl className="flex flex-wrap gap-6 text-sm">
        {[['Models', stats?.models], ['Labs', stats?.labs], ['Providers', stats?.providers], ['API listings', stats?.listings]].map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-[var(--muted)]">{String(label)}</dt>
            <dd className="num text-2xl">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <p>
        <Link className="underline" href="/models">Browse models</Link>
      </p>
    </div>
  );
}