import { globalSearch } from '@/lib/services/catalogue';
import { globalSearchSchema, parseQuery } from '@/lib/validation';
import { toSearchParams, type RawParams } from '@/lib/page';
import SearchExplorer from '@/components/SearchExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

/** Three bounded lookups, rendered as three groups. Server-rendered first; then the form is a
 *  client island fetching `GET /api/search`, so refining a term replaces only the groups
 *  (docs/decisions/0008). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = toSearchParams(await searchParams);
  const parsed = parseQuery(globalSearchSchema, sp);
  const groups = parsed.ok ? await globalSearch(parsed.data.q, parsed.data.perGroup).catch(() => null) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1>Search</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Names and slugs, case-insensitive, across models, labs and providers.</p>
      </div>

      <SearchExplorer
        key={parsed.ok ? parsed.data.q : ''}
        initialQ={parsed.ok ? parsed.data.q : ''}
        initialGroups={groups?.data ?? null}
        initialProblem={!parsed.ok ? 'needq' : parsed.ok && !groups ? 'unavailable' : null}
      />
    </div>
  );
}
