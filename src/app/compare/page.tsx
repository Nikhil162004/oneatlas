import { compareModels, listModels, modelDetail } from '@/lib/services/catalogue';
import { listQuerySchema } from '@/lib/validation';
import CompareExplorer, { type CompareRow, type Pick } from '@/components/CompareExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Compare' };

/**
 * Attributes down the left, models across the top, and the selection carried in `?ids=`.
 * Server-rendered for the first paint; after that the picker is a client island fetching
 * `GET /api/models/compare` (docs/decisions/0008), so ticking a box and pressing Compare
 * redraws only the table, and a comparison is still a link you can paste. Any model can be
 * added from the island's search, not only the recent releases shortlisted below, and a
 * single arriving slug ("Compare this model" on a detail page) is a valid first pick.
 */
export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const fromRepeated = raw.id === undefined ? [] : Array.isArray(raw.id) ? raw.id : [raw.id];
  const fromCsv = raw.ids === undefined ? [] : String(raw.ids).split(',');
  const ids = [...new Set([...fromRepeated, ...fromCsv].map((s) => s.trim().toLowerCase()).filter(Boolean))];
  const selection = ids.slice(0, 6);

  const [result, browse, picks] = await Promise.all([
    selection.length >= 2 ? compareModels(selection).catch(() => ({ selected: [], rows: [] })) : Promise.resolve({ selected: [], rows: [] }),
    // The picker shortlist is the /models query through the same schema the route uses.
    listModels({ ...listQuerySchema.parse({}), sort: 'released', limit: 24 }).catch(() => ({ data: [] })),
    // Resolve the arriving picks to names, so a slug from a detail page shows as a model,
    // not as a string, and an unknown slug quietly drops out instead of haunting the grid.
    Promise.all(
      selection.map(async (slug): Promise<Pick | null> => {
        const cut = slug.indexOf('/');
        if (cut < 1) return null;
        const found = await modelDetail(slug.slice(0, cut), slug.slice(cut + 1)).catch(() => null);
        return found ? { slug: found.slug, name: found.name, contextWindow: found.contextWindow } : null;
      }),
    ),
  ]);

  // Dates cross to the client as strings: the API returns them that way too, so the island
  // renders one shape whether the rows came from the server or from a fetch.
  const rows: CompareRow[] = result.rows.map((r) => ({
    ...r,
    releaseDate: r.releaseDate ? new Date(r.releaseDate).toISOString() : null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1>Compare</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Two to six models, one attribute per row.</p>
      </div>

      <CompareExplorer
        key={ids.join(',')}
        initialRows={rows}
        initialSelected={result.selected}
        initialPicks={picks.filter((p): p is Pick => p !== null)}
        browse={browse.data.map((m) => ({ slug: m.slug, name: m.name, contextWindow: m.contextWindow }))}
      />
    </div>
  );
}
