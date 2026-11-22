import Link from 'next/link';
import { compareModels, listModels } from '@/lib/services/catalogue';
import { compareSchema, listQuerySchema } from '@/lib/validation';
import { CapabilityTags, Empty, Notice, Section } from '@/components/ui';
import { contextLabel, dateLabel, pricePair } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Compare' };

/**
 * Attributes down the left, models across the top, and the selection carried in `?ids=`. Two
 * consequences worth having: a comparison is a link you can paste, and the "only show differences"
 * idea does not need client state, because a server render can mark the differing rows itself.
 */
export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const fromRepeated = raw.id === undefined ? [] : Array.isArray(raw.id) ? raw.id : [raw.id];
  const fromCsv = raw.ids === undefined ? [] : String(raw.ids).split(',');
  const ids = [...new Set([...fromRepeated, ...fromCsv].map((s) => s.trim().toLowerCase()).filter(Boolean))];

  const parsed = compareSchema.safeParse({ modelIds: ids.slice(0, 6) });
  const selection = parsed.success ? parsed.data.modelIds : [];

  const [result, browse] = await Promise.all([
    selection.length >= 2 ? compareModels(selection).catch(() => ({ selected: [], rows: [] })) : Promise.resolve({ selected: [], rows: [] }),
    // The picker is the /models query through the same schema the route uses.
    listModels({ ...listQuerySchema.parse({}), sort: 'released', limit: 24 }).catch(() => ({ data: [] })),
  ]);

  const rows = result.rows;
  const benchSlugs = [...new Set(rows.flatMap((r) => Object.keys(r.benchmarks)))];
  const differs = (values: string[]) => new Set(values).size > 1;

  const attrs: Array<{ label: string; values: string[]; num?: boolean }> = [
    { label: 'Type', values: rows.map((m) => m.modelType.toLowerCase()) },
    { label: 'Context', values: rows.map((m) => contextLabel(m.contextWindow)), num: true },
    { label: 'Max output', values: rows.map((m) => contextLabel(m.maxOutputTokens)), num: true },
    { label: 'Cheapest in / out per 1M', values: rows.map((m) => pricePair(m.cheapest.prompt, m.cheapest.completion)), num: true },
    { label: 'Providers', values: rows.map((m) => String(m.providers.length)), num: true },
    { label: 'Served by', values: rows.map((m) => (m.providers.length ? m.providers.slice(0, 4).map((p) => p.provider).join(', ') : '\u2014')) },
    { label: 'Released', values: rows.map((m) => dateLabel(m.releaseDate)), num: true },
    ...benchSlugs.map((b) => ({
      label: rows.find((r) => r.benchmarks[b])?.benchmarks[b]?.name ?? b,
      values: rows.map((m) => (m.benchmarks[b] ? m.benchmarks[b].score.toFixed(1) : '\u2014')),
      num: true,
    })),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1>Compare</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Two to six models, one attribute per row.</p>
        {ids.length > 6 && (
          <p className="mt-3">
            <Notice>Only the first six of your {ids.length} models are compared. Drop one and the table stays readable.</Notice>
          </p>
        )}
      </div>

      {rows.length ? (
        <>
          <Section id="table" title="Side by side" count={rows.length} />
          <div className="tablewrap compare">
            <table className="text-sm">
              <caption className="sr-only">Comparison table with one row per attribute and one column per model</caption>
              <thead>
                <tr>
                  <th scope="col">Attribute</th>
                  {rows.map((m) => (
                    <th key={m.id} scope="col">
                      <Link className="font-medium" href={`/models/${m.slug}`}>{m.name}</Link>
                      <span className="block text-xs font-normal text-[var(--faint)]">{m.lab.name}</span>
                      <Link className="mt-1 block text-xs text-[var(--faint)] underline" href={`/compare?ids=${selection.filter((s) => s !== m.slug).join(',')}`}>
                        Remove
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attrs.map((a) => (
                  <tr key={a.label}>
                    <th scope="row">{a.label}</th>
                    {a.values.map((v, i) => (
                      <td key={i} className={a.num ? 'num' : undefined} style={differs(a.values) ? { color: 'var(--fg)' } : { color: 'var(--muted)' }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Capabilities</th>
                  {rows.map((m) => (
                    <td key={m.id}><CapabilityTags caps={m.capabilities} /></td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Build a link</th>
                  <td colSpan={rows.length} className="num break-all text-xs text-[var(--faint)]">/compare?ids={selection.join(',')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Empty
          title={selection.length ? 'None of those slugs are in the catalogue' : 'Pick two models to start'}
          hint={selection.length ? 'A compare link only works while both models are mirrored.' : undefined}
        />
      )}

      <section>
        <Section id="picker" title={rows.length ? 'Swap a model in' : 'Recently released'} />
        <form method="get" action="/compare" className="card">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {browse.data.map((m) => (
              <li key={m.id}>
                <label className="chip w-full justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <input type="checkbox" name="id" value={m.slug} defaultChecked={selection.includes(m.slug)} />
                    <span className="truncate">{m.name}</span>
                  </span>
                  <span className="num text-[11px] text-[var(--faint)]">{contextLabel(m.contextWindow)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2">
            <button className="btn btn-primary" type="submit">Compare selection</button>
            <a className="btn" href="/compare">Clear</a>
            <span className="text-xs text-[var(--faint)]">2 to 6 boxes</span>
          </div>
        </form>
        {result.selected.some((s) => !s.found) && (
          <p className="mt-3">
            <Notice>Not loaded: {result.selected.filter((s) => !s.found).map((s) => s.slug).join(', ')}</Notice>
          </p>
        )}
        {!rows.length && <p className="mt-4 text-sm text-[var(--faint)]">Pick at least two models above to see the table.</p>}
      </section>
    </div>
  );
}
