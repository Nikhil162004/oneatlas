/**
 * SQL for the two endpoints that need an aggregate over a 1:N join (the model list, and the
 * benchmark ranking). Everything else is a plain Prisma client call — see docs/decisions/0002.
 *
 * One rule this file exists to enforce: the sort expression, the ORDER BY and the keyset cursor
 * predicate all come from the same `SORT` entry. Writing that expression twice, once in ORDER BY
 * and once in WHERE, is how "page 2 repeats row 25" bugs ship.
 *
 * NULL policy: every sort expression is COALESCE'd to a sentinel so it can never be NULL, which
 * makes `(expr, id) > ($1, $2)` a valid row comparison and gives "nulls last" in both directions.
 * shortcut: rows missing the sort value sit at the sentinel position; if a real dataset ever needs
 * true NULLS LAST ordering, switch the keyset to a ((expr IS NULL), expr, id) triple.
 */

import type { ListQuery } from './validation';

export type Dir = 'asc' | 'desc';
export type Built = { text: string; values: unknown[] };

/**
 * `cast` is what the cursor's stored value gets cast back to. A keyset comparison is a row
 * comparison, so the parameter must be the same type the expression is — `(timestamptz, text) >
 * ('2026-11-07', 'x')` is a type error in Postgres, and the page would 500 on the second request.
 */
const SORT: Record<string, { expr: string; dir: Dir; cast: string }> = {
  released: { expr: `COALESCE(m."releaseDate", %SENTINEL_DATE%)`, dir: 'desc', cast: 'timestamptz' },
  context: { expr: `COALESCE(m."contextWindow", %SENTINEL_NUM%)`, dir: 'desc', cast: 'int' },
  priceLow: { expr: `COALESCE(a."minPrompt", %SENTINEL_NUM%)`, dir: 'asc', cast: 'numeric' },
  priceHigh: { expr: `COALESCE(a."minPrompt", %SENTINEL_NUM%)`, dir: 'desc', cast: 'numeric' },
  name: { expr: `lower(m."name")`, dir: 'asc', cast: 'text' },
};

/** The only place a sort key becomes SQL. Unknown keys fall back to `released`, never to user text. */
export function sortOf(sort: string | undefined, requested?: Dir) {
  const entry = (sort && SORT[sort]) || SORT.released!;
  const dir = requested ?? entry.dir;
  // asc pushes missing values to the end with a high sentinel, desc with a low one.
  const expr = entry.expr
    .replace('%SENTINEL_NUM%', dir === 'asc' ? '999999999999' : '-1')
    .replace('%SENTINEL_DATE%', dir === 'asc' ? `'9999-12-31'::timestamptz` : `'epoch'::timestamptz`);
  return { expr, dir, cast: entry.cast };
}

/** A user typing `%` into the search box must not turn into a wildcard. */
export function likeTerm(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/*
 * One pass over this model's listings for all three numbers. The first version also carried
 * `array_agg(DISTINCT pv.name ORDER BY pv.name)` so the list could show who serves a model; EXPLAIN
 * showed that costing a full Provider scan per row (loops = 106). The list shows a count and the
 * detail page has the names, so the column is gone rather than indexed.
 */
const LISTING_AGGREGATE = `
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int                   AS listings,
           -- Endpoint listings only: a model with a catalogue price and no mirror of any provider
           -- endpoint is not "served by 1 provider", it is served by none that we can see.
           COUNT(DISTINCT CASE WHEN p."source" = 'ENDPOINT' THEN p."providerId" END)::int AS providers,
           MIN(p."promptPer1M")            AS "minPrompt",
           MIN(p."completionPer1M")        AS "minCompletion"
    FROM "ModelListing" p
    WHERE p."modelId" = m.id
  ) a ON true`;

/**
 * All filters in one place, so list and ranking cannot drift apart.
 *
 * The casts are not decoration. `$queryRawUnsafe` sends every parameter as text, and Postgres will
 * not compare text against an enum or an integer: `WHERE m."modelType" = $1` dies with
 * `operator does not exist: "ModelType" = text` the moment a caller filters by type. Verified
 * against a live database, caught by `npm run smoke`, invisible to a unit test that only reads the
 * SQL text. Any new filter on a non-text column needs its cast here.
 */
function conditions(f: Partial<ListQuery>, p: (v: unknown, cast?: string) => string): string[] {
  const w: string[] = [];
  if (f.q) {
    const t = likeTerm(f.q);
    w.push(`(m."name" ILIKE ${p(t)} ESCAPE '\\' OR m."slug" ILIKE ${p(t)} ESCAPE '\\')`);
  }
  if (f.lab) w.push(`l.slug = ${p(f.lab, 'text')}`);
  if (f.provider) {
    w.push(`EXISTS (SELECT 1 FROM "ModelListing" pe
                    JOIN "Provider" pve ON pve.id = pe."providerId"
                    WHERE pe."modelId" = m.id AND pve.slug = ${p(f.provider, 'text')})`);
  }
  if (f.type) w.push(`m."modelType" = ${p(f.type, '"ModelType"')}`);
  for (const c of f.capabilities ?? []) {
    const col =
      c === 'reasoning' ? 'supportsReasoning'
      : c === 'tools' ? 'supportsToolCalling'
      : c === 'structured' ? 'supportsStructuredOutput'
      : c === 'vision' ? 'supportsVisionInput'
      : 'openWeights';
    w.push(`m."${col}" = true`);
  }
  if (f.minContext != null) w.push(`m."contextWindow" >= ${p(f.minContext, 'int')}`);
  if (f.maxPrice != null) w.push(`a."minPrompt" <= ${p(f.maxPrice, 'numeric')}`);
  if (f.free) w.push(`EXISTS (SELECT 1 FROM "ModelListing" pf WHERE pf."modelId" = m.id AND pf."isFree")`);
  if (f.hideDeprecated) w.push(`m."deprecatedAt" IS NULL`);
  return w;
}

export function buildList(f: ListQuery): Built {
  const values: unknown[] = [];
  const p = (v: unknown, cast?: string) => `$${values.push(v)}${cast ? `::${cast}` : ''}`;

  const where = conditions(f, p);
  const { expr, dir, cast } = sortOf(f.sort, f.dir);
  const order = `${expr} ${dir.toUpperCase()}, m.id ${dir.toUpperCase()}`;

  if (f.cursor) {
    const c = decodeCursor(f.cursor);
    if (c) where.push(`(${expr}, m.id) ${dir === 'asc' ? '>' : '<'} (${p(c.v)}::${cast}, ${p(c.id)}::text)`);
  }

  // limit + 1 so the caller can tell "there is a next page" without a COUNT round trip.
  const sql = `
    SELECT m.id, m.slug, m.name, m."modelType",
           m."contextWindow", m."maxOutputTokens",
           m."supportsReasoning", m."supportsToolCalling", m."supportsStructuredOutput",
           m."supportsVisionInput", m."openWeights",
           l.slug AS "labSlug", l.name AS "labName",
           COALESCE(a.listings, 0)::int  AS listings,
           COALESCE(a.providers, 0)::int AS providers,
           a."minPrompt"::text     AS "minPrompt",
           a."minCompletion"::text AS "minCompletion",
           to_char(m."releaseDate", 'YYYY-MM-DD')   AS "releaseDate",
           to_char(m."deprecatedAt", 'YYYY-MM-DD')   AS "deprecatedAt",
           ${expr}::text                             AS "sortKey",
           ${f.cursor ? 'NULL' : 'COUNT(*) OVER ()::int'} AS total
    FROM "Model" m
    JOIN "Lab" l ON l.id = m."labId"${LISTING_AGGREGATE}
    ${where.length ? `WHERE ${where.join('\n      AND ')}` : ''}
    ORDER BY ${order}
    LIMIT ${p(f.limit + 1)}`;

  return { text: sql, values };
}

/** Leaderboard: model rows joined to one benchmark, ordered by score. Shares `conditions`. */
export function buildRanking(f: {
  benchmark?: string;
  category?: string;
  type?: string;
  minContext?: number;
  limit: number;
  offset: number;
}): Built {
  const values: unknown[] = [];
  const p = (v: unknown, cast?: string) => `$${values.push(v)}${cast ? `::${cast}` : ''}`;

  const where: string[] = [];
  if (f.benchmark) where.push(`b.slug = ${p(f.benchmark)}`);
  if (f.category) where.push(`b.category = ${p(f.category)}`);
  if (f.type) where.push(`m."modelType" = ${p(f.type, '"ModelType"')}`);
  if (f.minContext != null) where.push(`m."contextWindow" >= ${p(f.minContext, 'int')}`);
  where.push(`m."deprecatedAt" IS NULL`);

  const sql = `
    SELECT b.slug AS "benchmarkSlug", b.name AS "benchmarkName", b.category,
           s.score::text AS score,
           m.id, m.slug, m.name, m."modelType", m."contextWindow",
           l.slug AS "labSlug", l.name AS "labName",
           a."minPrompt"::text AS "minPrompt",
           COUNT(*) OVER ()::int AS total
    FROM "BenchmarkScore" s
    JOIN "Benchmark" b ON b.id = s."benchmarkId"
    JOIN "Model" m ON m.id = s."modelId"
    JOIN "Lab" l ON l.id = m."labId"
    LEFT JOIN LATERAL (
      SELECT MIN(p."promptPer1M") AS "minPrompt" FROM "ModelListing" p WHERE p."modelId" = m.id
    ) a ON true
    WHERE ${where.join('\n      AND ')}
    ORDER BY s.score DESC, m.id ASC
    LIMIT ${p(f.limit)} OFFSET ${p(f.offset)}`;

  return { text: sql, values };
}

export function encodeCursor(value: string | number | null | undefined, id: string) {
  return Buffer.from(`${id}\u0000${value ?? ''}`, 'utf8').toString('base64url');
}

/** A malformed, empty or foreign cursor is dropped and the caller returns page 1, not a 500:
 *  a stale "load more" link after someone changes the sort must not break the page. */
export function decodeCursor(cursor: string): { v: string; id: string } | null {
  try {
    const [id, v] = Buffer.from(cursor, 'base64url').toString('utf8').split('\u0000');
    // `v` is never empty for rows we produced (the sort expression is COALESCE'd), so an empty
    // value means the token is not ours.
    return id && v ? { v, id } : null;
  } catch {
    return null;
  }
}
