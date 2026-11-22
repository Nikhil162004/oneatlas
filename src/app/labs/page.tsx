import Link from 'next/link';
import { listLabs } from '@/lib/services/catalogue';
import { Empty, Meter, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Labs' };

/** Who trains models. A lab trains, a provider serves: two tables, because they are two facts. */
export default async function LabsPage() {
  const { data } = await listLabs(200).catch(() => ({ data: [] }));
  const byName = [...data].sort((a, b) => a.name.localeCompare(b.name));
  const max = Math.max(1, ...data.map((l) => l.modelCount));

  return (
    <div className="space-y-6">
      <div>
        <h1>Labs</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {data.length} organisations credited as trainers in the mirrored catalogue, most prolific first.
        </p>
      </div>

      {!data.length ? (
        <Empty title="No labs mirrored yet" hint="Run npm run ingest." />
      ) : (
        <>
          <Section id="directory" title="Directory" count={data.length} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {byName.map((l) => (
              <li key={l.slug}>
                <Link href={`/labs/${l.slug}`} className="card card-hover block">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{l.name}</span>
                    <span className="num text-[24px] leading-none">{l.modelCount}</span>
                  </span>
                  <span className="mt-2 block"><Meter value={l.modelCount} max={max} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
