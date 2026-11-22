# Review log — what the tooling said, and what I did

Nothing here is decoration: an unaddressed finding is a bug I chose. Skips carry a reason.

| Tool | Target | Finding | Action |
|---|---|---|---|
| `node --test` (19 tests) | `tokenCount` | test expected `128K → 131072`; code returns `128000` | **Convention decided, not drifted**: suffixes are decimal, because reading `128K` as `131072` invents a number the source did not print. Documented on the function; test corrected to assert the rule |
| `node --test` | keyset cursor | values list included the `LIMIT` parameter, test forgot it | Test was wrong, code right. Asserted the order explicitly: filters → cursor → limit |
| live ingest, `--endpoints` | `rawEndpointListSchema` | `status` is an **integer** upstream; declared `z.string()` → all 12 enriched models silently skipped | Widened to `string \| number`, and logged it as a decision: the failure mode was *loud but wrong-looking* (a whole model dropped). Also added `shortError()` so a ZodError prints one line per bad field instead of a pretty-printed array |
| `impeccable detect src/app` | 13 files | no findings in regex mode; tool states page-level rules (tiny text, contrast) did not run | Accepted as a partial pass. Full scan needs a browser: `npx impeccable detect http://localhost:3000` **could not run here** — no Chrome in the sandbox. Run it before submitting |
| Hallmark `sloplint --tier floor` (run from a clone, not vendored) | `src/app`, `docs/architecture.html` | 22 findings → fixed: colour literals outside tokens, 9px letter-spaced tags, arrow glued to a link label, missing `overflow-x: clip` | Down to **1 finding**, deliberately skipped below |
| live API curl | `/api/models?sort=released` | looked like page 2 returning *newer* rows than its cursor | Not a bug: I misread page 2's own `nextCursor` as page 1's. The DB plan (`ORDER BY COALESCE(releaseDate,'epoch') DESC`) and both pages agree. Written down because a wrong "fixed this" is worse than an open question |
| Hallmark `sloplint` | `globals.css`, `architecture.html` | "no Hallmark stamp on the first line of any CSS" | **Skipped on purpose.** The stamp marks a page as built with a Hallmark theme. This UI has no Hallmark theme: adopting the gate list is honest, adding the stamp would claim a design system I did not use |
| `ponytail` ladder | `src/lib/query.ts` | sort expression would have existed twice (ORDER BY + cursor) | One `SORT[key]` table now emits both, plus the parameter cast a row comparison needs |
| `ponytail` ladder | `src/lib/ingest/persist.ts` | benchmark scores passed a slug into an FK column | Resolve slug→id first; skip rows whose model was rejected upstream |
| `ponytail` ladder | `src/app/api/stats/route.ts` | `_sum` on a boolean column (Postgres has no boolean sum; fails at runtime) | `COUNT(*) FILTER (WHERE …)` raw read |
| **live Postgres**, `npm run ingest` | `persist.ts` | `Unknown argument` on `model.upsert`: spreading `ModelRow` leaked `labSlug` / `labName` (Lab fields) into the Model write | Both upserts now list their columns. A rename in the normaliser should not be able to invent a column |
| **live Postgres** + `npm run smoke` | `conditions()` | `operator does not exist: "ModelType" = text` (SQLSTATE 42883). `$queryRawUnsafe` binds text, so the enum, `minContext` and `maxPrice` filters all needed casts. **Unit tests passed while the endpoint 503'd**, because they only read the SQL text | Cast per filter (`::"ModelType"`, `::int`, `::numeric`) + a `query.test.ts` case that pins the casts so a new filter cannot forget one |
| `npm run smoke` | `presentRow` / `meta.total` | `?? 0` turned a deliberate `NULL` total into "zero results" — the exact "0 when it means unknown" mistake the code comment warns about | Empty page: `0` with no cursor (provably empty), `null` after a cursor (could just be past the end) |
| `EXPLAIN (ANALYZE, BUFFERS)` | `LISTING_AGGREGATE` | `array_agg(DISTINCT pv.name ORDER BY pv.name)` cost a full `Provider` scan per model (`loops=106`) | Column deleted rather than indexed: the list needs a count, the detail page has the names. Measured 3.25 ms for an unfiltered page of 476 models afterwards |
| `smoke` + `normalise` | `uptimePct` | `Out of range value for Decimal(5,2)`: upstream sends uptime **already as a percentage** (99.418…), my code assumed a 0..1 ratio and multiplied by 100. My own test asserted the same wrong assumption, so it passed green | Read the real payload, then fixed the function and the fixture values (99.4186 → '99.42', latency null → null). Lesson recorded below |

| `npm run lint:screens` (impeccable detect over rendered HTML) | 10 screens | **110 findings** once the tool could see the compiled CSS: 85 `cramped-padding`, 16 `undersized-ui-text`, 2 `low-contrast`, 7 `overused-font` | Down to **7**, all deliberate (below). Fixed: `--faint` `#6d6e77` was **3.86:1** on the page background — below AA — now `#8e9099` at **6.15:1**; the release-cadence month labels at 10px are now 11px; card and cell padding moved from Tailwind spacing tokens to explicit px in `.card`/`.rowline`/`th,td` |
| `npm run lint:screens` | `.card` | 73 of those 85 padding findings were false positives, and identifying them was the useful part: the tool cannot evaluate `calc(var(--spacing) * 3)`, so every token-padded box reads as flush | Padding for repeated chrome now lives in `globals.css` in px, with the reason written above it. A check whose output nobody can re-derive is not a gate — and px is one less thing for a reviewer to resolve mentally |
| `npm run lint:screens` | `tablewrap` | 12 findings: "children flush against border". The wrapper's only child is the `<table>`, which spans it edge to edge; the cells inside are padded | The frame moved from the scroll wrapper to the table (`border-collapse: separate` so the corners still round) and the last row's bottom rule was dropped, which was quietly doubling against the frame |
| `npm run lint:screens` | advisory | `em-dash-overuse`: 143 em-dashes on `/providers` | **Accepted, not a prose problem.** Those are table cells meaning "no value mirrored" — the same glyph as the unknown-price marker everywhere else in the app. Replacing it with a word would make the table wider and the meaning no clearer |
| `npm run lint:screens` | `layout.css` | `overused-font` ×7 for Geist Mono | **Kept.** One mono face carries every tabular figure in the product; loading a second family to satisfy "be distinctive" costs ~60 kB and buys nothing a data table needs. Documented in `DESIGN.md` rather than quietly ignored |
| curl vs. the 404 page | `src/app/loading.tsx` | adding a root `loading.tsx` made every streamed route commit HTTP 200 *before* `notFound()` ran: a perfectly rendered 404 page behind a 200 | File deleted; `error.tsx` and `not-found.tsx` kept. Smoke now asserts `status === 404`, so the soft-404 regression cannot come back with the next "nice loading state" |
| `npm run smoke` | the new page checks | three assertions failed against working pages: React splits `{n} matching` into `476<!-- --> matching`, and it reorders input attributes, so `value="tools" checked` never matched | `getPage` strips the comment separators and the chip check extracts the tag then looks inside it. A test that pins markup order is a test of the renderer's internals |
| reading my own page | `/providers` | header said "Median-ish in /1M" over a column that is an arithmetic mean | Renamed to "Avg input /1M". A hedged label is how a wrong one survives review |
| reading my own page | `/compare` | `className="flex cursor-items-center gap-2"` — a class I invented; the picker rows were unaligned | `items-center`. Only visible because the rendered snapshot put the boxes where I could look at them |

## The lesson I would repeat differently

## What the rendered-HTML pass changed about my method

The regex mode of `impeccable detect` told me nothing for three rounds because it was reporting on
source text, not on a page. Running it over saved HTML plus the compiled stylesheet produced 110
findings on the same code — including a real contrast failure on a token I had typed by hand and
never measured. The rule I would keep: **a lint that cannot see the artifact is not a gate**, and the
cheapest way to give it the artifact when there is no browser is to save the response body.

## The lesson I would repeat differently

Four of the bugs above (the enum cast, the Decimal range, the leaked spread fields) were invisible to
a green unit test suite and only appeared once a real Postgres answered. For this codebase that means:
`npm run smoke` against a running database is not a nice-to-have on top of `npm test` — it is the
check that the SQL layer exists at all. Both are wired into the scripts for that reason.
