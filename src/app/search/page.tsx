import Link from 'next/link';
import { globalSearch } from '@/lib/services/catalogue';
import { globalSearchSchema, parseQuery } from '@/lib/validation';
import { Empty, Notice, Section } from '@/components/ui';
import { toSearchParams, type RawParams } from '@/lib/page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

/** Three bounded lookups, rendered as three groups. A form, not a keystroke handler. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = toSearchParams(await searchParams);
  const parsed = parseQuery(globalSearchSchema, sp);
  const groups = parsed.ok ? await globalSearch(parsed.data.q, parsed.data.perGroup).catch(() => null) : null;

  const columns: Array<[string, Array<{ slug: string; name: string; meta: string; href: string }>]> = groups
    ? [
        ['Models', groups.data.models.map((m) => ({ slug: m.slug, name: m.name, meta: `${m.lab.name} · ${m.modelType.toLowerCase()}`, href: `/models/${m.slug}` }))],
        ['Labs', groups.data.labs.map((l) => ({ slug: l.slug, name: l.name, meta: `${l.modelCount} models`, href: `/labs/${l.slug}` }))],
        ['Providers', groups.data.providers.map((p) => ({ slug: p.slug, name: p.name, meta: `${p.listingCount} listings`, href: '/providers' }))],
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1>Search</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Names and slugs, case-insensitive, across models, labs and providers.</p>
      </div>

      <form method="get" action="/search" className="flex max-w-xl gap-2">
        <label className="sr-only" htmlFor="q">Search term</label>
        <input id="q" className="field w-full" type="search" name="q" defaultValue={parsed.ok ? parsed.data.q : ''} placeholder="claude" />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {!parsed.ok ? (
        <Notice>Type at least one character.</Notice>
      ) : !groups ? (
        <Empty title="Search is unavailable" hint="The database did not answer. /api/search runs the same query and reports its own error." />
      ) : groups.meta.empty ? (
        <Empty title={`Nothing matches “${parsed.data.q}”`} hint="Try part of a slug, for example claude or mistral." />
      ) : (
        <div className="grid gap-8 md:grid-cols-3">
          {columns.map(([title, items]) => (
            <section key={title}>
              <Section id={title} title={title} count={items.length} />
              {items.length ? (
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li key={`${title}-${i.slug}`}>
                      <Link href={i.href} className="card card-tight card-hover block">
                        <span className="block font-medium leading-snug">{i.name}</span>
                        <span className="num mt-0.5 block text-xs text-[var(--faint)]">{i.meta}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--faint)]">No {title.toLowerCase()} match.</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
