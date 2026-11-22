import Link from 'next/link';
import { listCollections } from '@/lib/services/catalogue';
import { Empty, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Collections' };

/**
 * Guided discovery: the questions readers actually arrive with, answered by queries over live
 * rows. Nothing here is a stored list — each card names its criteria, the leader is whoever the
 * current mirror puts first, and tonight's ingest re-ranks tomorrow's page. Not sure which
 * question is yours? The model finder at /finder asks three and builds the filter for you.
 */
export default async function CollectionsPage() {
  const { data } = await listCollections().catch(() => ({ data: [] }));

  return (
    <div className="space-y-6">
      <div>
        <h1>Collections</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Starting points, computed from the catalogue as it stands. Prefer to describe the job?{' '}
          <Link className="underline" href="/finder">Use the model finder</Link>.
        </p>
      </div>

      {!data.length ? (
        <Empty title="No collections computed yet" hint="Run npm run ingest to fill the catalogue." />
      ) : (
        <>
          <Section id="sets" title="Collections" count={data.length} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => (
              <li key={c.slug} className="card card-tight">
                <Link className="font-medium leading-snug underline-offset-2 hover:underline" href={`/collections/${c.slug}`}>{c.title}</Link>
                <p className="mt-1 text-sm text-[var(--muted)]">{c.blurb}</p>
                <p className="num mt-2 text-xs text-[var(--faint)]">
                  {c.count} models{c.leader ? ` · leading: ${c.leader}` : ''}
                </p>
                <p className="mt-1 text-xs text-[var(--faint)]">{c.criteria}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
