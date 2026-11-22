import Link from 'next/link';
import { globalSearch } from '@/lib/services/catalogue';
import { globalSearchSchema, parseQuery } from '@/lib/validation';
import { Empty, Notice } from '@/components/ui';
import { toSearchParams, type RawParams } from '@/lib/page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

/** Global lookup across the three directories. A form, not a keystroke handler — same trade as everywhere else here. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = toSearchParams(await searchParams);
  const parsed = parseQuery(globalSearchSchema, sp);
  const groups = parsed.ok ? await globalSearch(parsed.data.q, parsed.data.perGroup).catch(() => null) : null;
  const had = parsed.ok && groups && !groups.meta.empty;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Search</h1>
      <form method="get" action="/search" className="flex gap-2">
        <input className="field w-full max-w-md" type="search" name="q" defaultValue={parsed.ok ? parsed.data.q : ''} placeholder="model, lab or provider" />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      {!parsed.ok ? (
        <Notice>Type at least one character — a search for the empty string would be a table of everything.</Notice>
      ) : !groups ? (
        <Empty title="Search is unavailable" hint="The database did not answer. /api/search is the same query, and it reports its own error." />
      ) : groups.meta.empty ? (
        <Empty title={`Nothing matches \u201c${parsed.data.q}\u201d`} hint="Names are matched as typed, case-insensitive. Try part of a slug, e.g. claude or mistral." />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {([['Models', groups.data.models.map((m) => ({ slug: m.slug, name: m.name, meta: `${m.lab.name} · ${m.modelType.toLowerCase()}`, href: `/models/${m.slug}` }))],
             ['Labs', groups.data.labs.map((l) => ({ slug: l.slug, name: l.name, meta: `${l.modelCount} models`, href: `/labs/${l.slug}` }))],
             ['Providers', groups.data.providers.map((p) => ({ slug: p.slug, name: p.name, meta: `${p.listingCount} listings`, href: `/providers` }))] ] as const).map(([title, items]) => (
            <section key={title}>
              <h2 className="mb-2 text-sm uppercase tracking-wide text-[var(--muted)]">{title} <span className="num">{items.length}</span></h2>
              {items.length ? (
                <ul className="space-y-1 text-sm">
                  {items.map((i) => (
                    <li key={`${title}-${i.slug}`} className="card">
                      <Link className="underline-offset-2 hover:underline" href={i.href}>{i.name}</Link>
                      <p className="text-xs text-[var(--muted)]">{i.meta}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-[var(--muted)]">none</p>}
            </section>
          ))}
        </div>
      )}
      {had && null}
    </div>
  );
}
