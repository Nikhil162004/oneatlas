import { buildList, encodeCursor } from '@/lib/query';
import { parseQuery, listQuerySchema } from '@/lib/validation';
import { badRequest, ok, presentRow, route, type ListRow } from '@/lib/api';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic'; // filters live in the URL; caching a stale page beats caching none

/**
 * GET /api/models — the module 1 endpoint: search, filter, sort, paginate.
 *
 * limit+1 rows are read so `nextCursor` can be decided without a second COUNT query; the extra
 * row is dropped from the payload. `total` comes from the window function in the same statement.
 */
export const GET = route(async function modelsList(request: Request) {
  const url = new URL(request.url);
  const parsed = parseQuery(listQuerySchema, url.searchParams);
  if (!parsed.ok) return badRequest(parsed.fields);

  const { text, values } = buildList(parsed.data);
  const rows = (await prisma.$queryRawUnsafe(text, ...values)) as ListRow[];
  const hasMore = rows.length > parsed.data.limit;
  const page = hasMore ? rows.slice(0, parsed.data.limit) : rows;
  const last = page[page.length - 1];

  return ok(page.map(presentRow), {
    total: page[0]?.total ?? 0,
    limit: parsed.data.limit,
    sort: parsed.data.sort,
    dir: parsed.data.dir ?? undefined,
    nextCursor: hasMore && last ? encodeCursor(last.sortKey, last.id) : null,
  });
});
