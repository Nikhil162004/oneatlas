# Keyset, with one definition of "sorted"

Offset paging on a list sorted by release date changes membership while the user is on page 2 — a
new model lands and rows repeat or vanish. So the cursor is the pair the ORDER BY uses:

    WHERE (COALESCE(m."releaseDate", 'epoch'::timestamptz), m.id) > ($1::timestamptz, $2)
    ORDER BY COALESCE(m."releaseDate", 'epoch'::timestamptz) DESC, m.id DESC

`SORT[key]` in `src/lib/query.ts` is the single source for the expression, its direction and its
parameter cast, because the row comparison needs the same type as the expression — comparing a
`timestamptz` against a text parameter is a type error, which would only surface on the *second*
page. The `sortKey` column is selected from the same expression so a cursor is always built from
what Postgres actually sorted on, not from a formatted display value.

Ranks are the exception: `/api/rankings` uses `LIMIT/OFFSET` on purpose, because jumping to rank 40
is the interaction. `tests/query.test.ts` asserts every placeholder in the built SQL is used exactly
once and in push order — that is the invariant hand-built SQL loses first.
