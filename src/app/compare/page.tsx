import Link from 'next/link';
import { compareModels, listModels } from '@/lib/services/catalogue';
import { compareSchema, listQuerySchema } from '@/lib/validation';
import { Empty, Notice, CapabilityBadges } from '@/components/ui';
import { contextLabel, dateLabel, pricePair } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Compare' };

/**
 * Compare, with no client JavaScript: the selection lives in `?ids=a,b,c`, a checkbox form writes
 * it, and a remove link rewrites it. That makes a comparison paste-able, which is the one feature
 * of this screen that actually gets used.
 */
export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const fromRepeated = raw.id === undefined ? [] : Array.isArray(raw.id) ? raw.id : [raw.id];
  const fromCsv = raw.ids === undefined ? [] : String(raw.ids).split(',');
  const ids = [...new Set([...fromRepeated, ...fromCsv].map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, 8);

  const parsed = compareSchema.safeParse({ modelIds: ids.slice(0, 6) });
  const tooMany = ids.length > 6;
  const selection = parsed.success ? parsed.data.modelIds : [];

  const [result, browse] = await Promise.all([
    selection.length >= 2 ? compareModels(selection).catch(() => ({ selected: [], rows: [] })) : Promise.resolve({ selected: [], rows: [] }),
    // The picker list is the /models query with two overrides, run through the same schema the
    // route uses, so there is no second definition of "what a valid list query looks like".
    listModels({ ...listQuerySchema.parse({}), sort: 'released', limit: 24 }).catch(() => ({ data: [] })),
  ]);

  const benchSlugs = [...new Set(result.rows.flatMap((r) => Object.keys(r.benchmarks)))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Compare</h1>
        <p className="text-sm text-[var(--muted)]">Two to six models, side by side. {selection.length ? `The URL is the selection: <code>?ids=${selection.join(',')}</code>` : 'Tick models below to build one.'}</p>
        {tooMany && <Notice>Only the first six of your {ids.length} models are compared — a wider table stops being readable.</Notice>}
      </div>

      {selection.length < 2 && (
        <form method="get" action="/compare" className="rounded-md border border-[var(--line)] p-4">
          <p className="mb-2 text-sm text-[var(--muted)]">Recently released — tick 2 to 6:</p>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {browse.data.map((m) => (
              <li key={m.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="id" value={m.slug} />
                  <Link className="underline-offset-2 hover:underline" href={`/models/${m.slug}`}>{m.name}</Link>
                  <span className="num text-xs text-[var(--muted)]">{contextLabel(m.contextWindow)}</span>
                </label>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary mt-3" type="submit">Compare selection</button>
        </form>
      )}

      {result.rows.length ? (
        <div className="tablewrap">
          <table className="min-w-[720px] text-sm">
            <caption className="sr-only">Comparison table: one row per attribute, one column per model</caption>
            <thead>
              <tr>
                <th scope="col" className="w-40">Attribute</th>
                {result.rows.map((m) => (
                  <th key={m.id} scope="col">
                    <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${m.slug}`}>{m.name}</Link>
                    <div className="text-xs font-normal text-[var(--muted)]">{m.lab.name}</div>
                    <button className="mt-1 text-xs text-[var(--muted)] underline" type="button">
                      <Link href={`/compare?ids=${selection.filter((s) => s !== m.slug).join(',')}`}>remove</Link>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Type" values={result.rows.map((m) => m.modelType.toLowerCase())} />
              <CompareRow label="Context" values={result.rows.map((m) => contextLabel(m.contextWindow))} num />
              <CompareRow label="Max output" values={result.rows.map((m) => contextLabel(m.maxOutputTokens))} num />
              <CompareRow label="Cheapest in / out" values={result.rows.map((m) => pricePair(m.cheapest.prompt, m.cheapest.completion))} num />
              <CompareRow label="Providers" values={result.rows.map((m) => String(m.providers.length))} num />
              <CompareRow label="Served by" values={result.rows.map((m) => (m.providers.length ? m.providers.slice(0, 4).map((p) => p.provider).join(', ') : '\u2014'))} />
              <CompareRow label="Released" values={result.rows.map((m) => dateLabel(m.releaseDate))} num />
              <tr>
                <th scope="row" className="font-normal text-[var(--muted)]">Capabilities</th>
                {result.rows.map((m) => <td key={m.id}><CapabilityBadges caps={m.capabilities} /></td>)}
              </tr>
              {benchSlugs.map((b) => (
                <CompareRow key={b} label={result.rows.find((r) => r.benchmarks[b])?.benchmarks[b]?.name ?? b} values={result.rows.map((m) => (m.benchmarks[b] ? m.benchmarks[b].score.toFixed(1) : '\u2014'))} num />
              ))}
            </tbody>
          </table>
        </div>
      ) : selection.length >= 2 ? (
        <Empty title="None of those slugs are in the catalogue" hint="Check the ids — a compare link only works while the model is mirrored." />
      ) : (
        <p className="text-sm text-[var(--muted)]">Pick at least two models above to see the table.</p>
      )}

      {result.selected.some((s) => !s.found) && (
        <Notice>Some of what you asked for could not be loaded: {result.selected.filter((s) => !s.found).map((s) => s.slug).join(', ')}. The table shows the rest.</Notice>
      )}
    </div>
  );
}

function CompareRow({ label, values, num = false }: { label: string; values: string[]; num?: boolean }) {
  return (
    <tr>
      <th scope="row" className="font-normal text-[var(--muted)]">{label}</th>
      {values.map((v, i) => <td key={i} className={num ? 'num' : undefined}>{v}</td>)}
    </tr>
  );
}
