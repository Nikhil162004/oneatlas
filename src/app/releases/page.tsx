import Link from 'next/link';
import { releaseTimeline } from '@/lib/services/catalogue';
import { Empty, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Releases' };

/**
 * What shipped, month by month, across every lab: the global version of the release cadence a
 * lab page shows for itself. Dates come from the catalogue mirror and are grouped, never
 * curated; models the source never dated are counted below rather than placed by guesswork.
 */
export default async function ReleasesPage() {
  const { data, meta } = await releaseTimeline().catch(() => ({ data: [], meta: { months: 0, dated: 0, undated: 0 } }));

  return (
    <div className="space-y-10">
      <div>
        <h1>Releases</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          <span className="num">{meta.dated} dated releases</span> across <span className="num">{meta.months} months</span>.
          {meta.undated > 0 && (
            <>
              {' '}The source never dated <span className="num">{meta.undated} models</span>; they are counted here, not placed by guesswork.
            </>
          )}
        </p>
      </div>

      {!data.length ? (
        <Empty title="No dated releases mirrored yet" hint="Run npm run ingest to fill the catalogue." />
      ) : (
        data.map((m) => (
          <section key={m.month}>
            <Section
              id={`m-${m.month}`}
              title={new Date(`${m.month}-02T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              count={m.count}
            />
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {m.models.map((model) => (
                <li key={model.slug} className="card card-tight">
                  <Link className="font-medium leading-snug underline-offset-2 hover:underline" href={`/models/${model.slug}`}>{model.name}</Link>
                  <p className="num mt-1 text-xs text-[var(--faint)]">
                    {model.lab.name} · {model.day}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
