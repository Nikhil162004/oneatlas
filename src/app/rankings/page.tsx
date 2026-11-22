import Link from 'next/link';
import { rankings } from '@/lib/services/catalogue';
import { toSearchParams, type RawParams } from '@/lib/page';
import { MODEL_TYPES, parseQuery, rankingQuerySchema } from '@/lib/validation';
import { Notice } from '@/components/ui';
import RankingsExplorer from '@/components/RankingsExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rankings' };

/**
 * Leaderboard. Server-rendered first, then a client island fetches `GET /api/rankings` so a
 * chip, a category or a page turn redraws only the board (docs/decisions/0008). Offset paging,
 * not the keyset cursor /models uses: a rank only means something as an absolute position, so
 * "rows 50 to 100 of this ordering" is the honest query here.
 */
export default async function RankingsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const sp = toSearchParams(raw);
  const parsed = parseQuery(rankingQuerySchema, sp);
  if (!parsed.ok) {
    return (
      <Notice>
        Those ranking params were rejected: {Object.keys(parsed.fields).join(', ')}.{' '}
        <Link className="underline" href="/rankings">Reset</Link>.
      </Notice>
    );
  }

  const q = parsed.data;
  const { data, meta } = await rankings(q).catch(() => ({ data: [], meta: { total: 0, limit: q.limit, offset: q.offset, benchmarks: [] as Array<{ slug: string; name: string; category: string; unit: string; scored: number }> } }));

  return (
    <div className="space-y-6">
      <div>
        <h1>Rankings</h1>
        <RankingsExplorer
          key={sp.toString()}
          initialData={data}
          initialMeta={meta}
          initialSearch={sp.toString()}
          modelTypes={MODEL_TYPES}
        />
      </div>
    </div>
  );
}
