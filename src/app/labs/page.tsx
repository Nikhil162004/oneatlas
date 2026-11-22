import Link from 'next/link';
import { listLabs } from '@/lib/services/catalogue';
import { Empty, StatRow } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Labs' };

/** Who trains models. `lab` and `provider` are different tables — a lab trains, a provider serves. */
export default async function LabsPage() {
  const { data } = await listLabs(200).catch(() => ({ data: [] }));
  const byName = [...data].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Labs</h1>
        <p className="text-sm text-[var(--muted)]">{data.length} organisations credited as trainers in the mirrored catalogue, most prolific first.</p>
      </div>
      {!data.length ? (
        <Empty title="No labs mirrored yet" hint="Run npm run ingest." />
      ) : (
        <>
          <StatRow items={[['Labs', data.length], ['Shipping 10+ models', data.filter((l) => l.modelCount >= 10).length], ['Single-model labs', data.filter((l) => l.modelCount === 1).length]]} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {byName.map((l) => (
              <li key={l.slug} className="card">
                <Link href={`/labs/${l.slug}`} className="font-medium underline-offset-2 hover:underline">{l.name}</Link>
                <p className="num text-xs text-[var(--muted)]">{l.modelCount} models</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
