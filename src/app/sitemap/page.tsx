import Link from 'next/link';
import { prisma } from '@/lib/db';
import { SITE_URL } from '@/lib/site';
import { Empty, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sitemap' };

const SCREENS: Array<[string, string]> = [
  ['/', 'Home'],
  ['/models', 'Models'],
  ['/rankings', 'Rankings'],
  ['/benchmarks', 'Benchmarks'],
  ['/benchmarks/matrix', 'Benchmark matrix'],
  ['/releases', 'Releases'],
  ['/compare', 'Compare'],
  ['/calculator', 'Cost calculator'],
  ['/collections', 'Collections'],
  ['/finder', 'Model finder'],
  ['/labs', 'Labs'],
  ['/providers', 'Providers'],
  ['/changes', 'Changes'],
  ['/status', 'Status'],
  ['/watchlist', 'Watchlist'],
  ['/search', 'Search'],
  ['/api', 'JSON API'],
  ['/openapi', 'OpenAPI document'],
];

/**
 * The sitemap as a page. /sitemap.xml remains the machine artefact crawlers read (same
 * mirror, same URLs); this renders the same inventory for a human who clicked the footer
 * link, grouped the way the site itself is grouped. Models sit under their labs, because
 * a flat list of several hundred links helps nobody scan.
 */
export default async function SitemapPage() {
  const [models, labs, providers, benchmarks] = await Promise.all([
    prisma.model
      .findMany({
        select: { slug: true, name: true, lab: { select: { slug: true, name: true } } },
        orderBy: { name: 'asc' },
      })
      .catch(() => []),
    prisma.lab.findMany({ select: { slug: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.provider.findMany({ select: { slug: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.benchmark.findMany({ select: { slug: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
  ]);

  type ModelItem = { slug: string; name: string; lab: { slug: string; name: string } };
  const byLab = new Map<string, { lab: ModelItem['lab']; models: ModelItem[] }>();
  for (const m of models) {
    if (!byLab.has(m.lab.slug)) byLab.set(m.lab.slug, { lab: m.lab, models: [] });
    byLab.get(m.lab.slug)!.models.push(m);
  }
  const labGroups = [...byLab.values()].sort((a, b) => b.models.length - a.models.length);

  return (
    <div className="space-y-10">
      <div>
        <h1>Sitemap</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Every public page on the site, from the same mirror the XML sitemap is generated from. Search
          engines read that file instead: <a className="underline" href={`${SITE_URL}/sitemap.xml`}>sitemap.xml</a>.
        </p>
      </div>

      <section>
        <Section id="screens" title="Screens" count={SCREENS.length} />
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {SCREENS.map(([href, label]) => (
            <li key={href}><Link className="underline-offset-2 hover:underline" href={href}>{label}</Link></li>
          ))}
        </ul>
      </section>

      {!models.length ? (
        <Empty title="The catalogue mirror is empty" hint="Run npm run ingest to fill it, and this page fills with it." />
      ) : (
        <>
          <section>
            <Section id="models" title="Models by lab" count={models.length} />
            <div className="space-y-6">
              {labGroups.map(({ lab, models: group }) => (
                <div key={lab.slug}>
                  <p className="text-sm">
                    <Link className="font-medium underline-offset-2 hover:underline" href={`/labs/${lab.slug}`}>{lab.name}</Link>{' '}
                    <span className="num text-xs text-[var(--faint)]">{group.length}</span>
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
                    {group.map((m) => (
                      <li key={m.slug}>
                        <Link className="underline-offset-2 hover:text-[var(--fg)] hover:underline" href={`/models/${m.slug}`}>{m.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <Section id="labs" title="Labs" count={labs.length} />
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--muted)]">
              {labs.map((l) => (
                <li key={l.slug}><Link className="underline-offset-2 hover:text-[var(--fg)] hover:underline" href={`/labs/${l.slug}`}>{l.name}</Link></li>
              ))}
            </ul>
          </section>

          <section>
            <Section id="providers" title="Providers" count={providers.length} />
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--muted)]">
              {providers.map((p) => (
                <li key={p.slug}><Link className="underline-offset-2 hover:text-[var(--fg)] hover:underline" href={`/providers/${p.slug}`}>{p.name}</Link></li>
              ))}
            </ul>
          </section>

          <section>
            <Section id="benchmarks" title="Benchmarks" count={benchmarks.length} />
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--muted)]">
              {benchmarks.map((b) => (
                <li key={b.slug}><Link className="underline-offset-2 hover:text-[var(--fg)] hover:underline" href={`/benchmarks/${b.slug}`}>{b.name}</Link></li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
