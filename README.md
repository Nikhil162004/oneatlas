# OneAtlas — AI model discovery & intelligence platform

Full Stack Engineer submission. **Live URL:** _fill in_ · **Repo:** _fill in_ · **Loom:** _fill in_

## What it is

MVP of a model-discovery product: browse and filter a catalogue of AI models, read a full spec
sheet per model, compare up to six side by side, rank by benchmark, and browse the labs and
providers behind them. Data is ingested from a public catalogue into Postgres and reaches every
screen through the API — there is no fixture array in the frontend.

## Stack

Next.js (App Router, server components) · React · TypeScript · TailwindCSS · Next.js route handlers ·
Zod · PostgreSQL · Prisma. Vercel + Neon is the deploy target; nothing here needs anything else.

Seven screens, ten API routes, one Postgres schema. **No client JavaScript in the pages**: filters,
sorts, cursors and the compare selection are query strings submitted by native `<form>`s, so the URL
is the state and every screen renders from the same service its endpoint does
(`docs/decisions/0006-the-url-is-the-state.md`).

## Run it

```bash
npm install
cp .env.example .env            # point DATABASE_URL at Postgres
npx prisma migrate dev          # or: npm run db:deploy
npx tsx scripts/ingest.ts --limit 60 --dry   # see it work without a database
npx tsx scripts/ingest.ts --limit 60          # write 60 models
npm run dev
```

`--endpoints` adds the per-provider listing enrichment; `--offline fixtures/or_models.json` replays a
saved payload; `--dry` normalises and reports without touching the database.

## Layout

```
prisma/schema.prisma        Lab · Provider · Model · ModelListing · Benchmark(+Score) · IngestRun
prisma/sql/search.sql       pg_trgm GIN indexes (Prisma can't state an operator class)
src/lib/ingest/normalise.ts pure: units, money, slugs, capabilities, benchmarks  ← the tested core
src/lib/ingest/persist.ts   idempotent upserts + IngestRun audit row
src/lib/query.ts            filters + sort + keyset cursor, one definition of each
src/lib/validation.ts       zod at every boundary
src/lib/api.ts              response envelope, error mapping, cache policy
src/app/api/*               ten endpoints, all under a versioned contract (see docs/DESIGN.md §API)
src/app/{models,rankings,…} the seven screens; server components only
src/lib/services/*          the read side both the pages and the routes call — no page fetches /api
src/lib/{present,format,page}.ts  row→JSON mapping, number/date display, searchParams→query
src/components/ui.tsx       badges, empty/error states, pager
tests/                      node:test over the pure layer: npm test
scripts/smoke.mjs           18 contract checks against a running server, API *and* HTML
docs/                       DESIGN.md, decisions/0001-0006, ui-brief.md, review-log.md
```

## Screens

| Route | Shows | Where its numbers come from |
|---|---|---|
| `/` | counters + capability coverage | `services/stats` |
| `/models` | the table: search, type, lab, capabilities, context floor, price ceiling, free, hide-deprecated, 5 sorts, cursor paging | `services/catalogue.listModels` |
| `/models/{lab}/{slug}` | spec grid, description, **every provider listing** (price, context, quant, p50 latency, 24 h uptime), benchmark strip | `modelDetail` |
| `/compare?ids=a,b` | attributes as rows, up to six models as columns, missing ids named | `compareModels` |
| `/rankings` | leaderboard, benchmark chips, offset paging with a stated range | `rankings` |
| `/labs`, `/labs/{slug}` | 60 labs by output; a lab's models plus a month-by-month release cadence | `listLabs`, `labDetail` |
| `/providers` | who serves what: models, listings, free count, cheapest/avg price, avg latency and uptime | `listProviders` |
| `/search?q=` | models / labs / providers in three groups | `globalSearch` |

Filters live in the URL, so a filtered view is a link. Production timings on this machine, best of
five: `/models` 25 ms, `/rankings` 23 ms, `/providers` 24 ms, `/labs` 11 ms, a model page 12 ms —
each including its SQL.

## Reading order for a reviewer

1. `DESIGN.md` — scope, and the list of things deliberately not built.
2. `docs/decisions/0001` — why `ModelListing` is the centre of the schema.
3. `docs/decisions/0005` + `src/lib/query.ts` — the keyset cursor, and why one table owns "sorted".
4. `tests/query.test.ts` — the placeholder-invariant test that keeps hand-built SQL honest.
5. `docs/decisions/0003` — why search is `pg_trgm` and not Meilisearch.
6. `docs/decisions/0006` — why the pages contain no JavaScript, and what that deleted.
7. `scripts/smoke.mjs` — the checks that make "it works" a reproducible claim rather than a screenshot.

## Verify — what is actually green, and what is not

Ran on 2026-11-21 in the dev sandbox (Node 20, no Postgres, no Chrome):

```
npx prisma validate                       clean
npx tsc --noEmit                          clean
npm test                                  21/21 pass
npx next build                            clean, 17 routes (10 API + 7 pages), 103 kB shared JS
npx tsx scripts/ingest.ts --offline fixtures/or_models_full.json --dry
                                          476 records in → 476 models, 60 labs, 476 listings,
                                          7 benchmarks / 756 scores, 0 issues
npx tsx scripts/ingest.ts --limit 12 --endpoints --dry
                                          12 models → 31 listings across 8 providers
Hallmark sloplint --tier floor      1 finding left, skipped on purpose (see docs/review-log.md)
npx impeccable detect src/app             no findings in regex mode
npx impeccable detect .design-scan        110 findings on rendered HTML -> 7 (see docs/review-log.md)
```

Ran against a real database afterwards (embedded Postgres 18.7 on port 55432, `node scripts/pg.mjs`):

```
npx prisma migrate deploy                       applied 20261121000000_init (incl. pg_trgm indexes)
npm run ingest                                  476 models, 60 labs, 7 benchmarks, 756 scores, 0 issues
npm run ingest -- --limit 120 --endpoints         120 models -> 378 listings across 75 providers
re-ran the identical ingest                       row counts unchanged  -> idempotency proven
npm run smoke                                   18/18 against the dev server
NEXT_DIST_DIR=.next-build npx next start        18/18 again against the production build
npm run explain                                 see below
```

`EXPLAIN (ANALYZE, BUFFERS)` on `GET /api/models` page 1, unfiltered, 476 models: **3.25 ms**,
top-N heapsort over 26 of 476 rows, `Seq Scan on "Model"` (476 rows is below any index threshold —
the plan is right, not lazy). With `type=IMAGE&capabilities=tools,vision&minContext=100000`:
**0.21 ms**, `Index Scan using "Model_modelType_releaseDate_idx"`. The first measurement also caught a
real cost: `array_agg(DISTINCT provider name)` was doing a full `Provider` scan per model (`loops=106`),
so that column was deleted from the list query instead of indexed — the list shows a count, the
detail page shows names.

**Still not verified, and you must run it:** the browser-grade scans (`npx impeccable detect
http://localhost:3000`, `sloplint --render`) and the Vercel + Neon deployment itself — this sandbox
has no Chrome and no Vercel access. See `docs/review-log.md` for every finding, the four bugs the
database and the linters caught in my own code, and why each skip is a decision rather than an
oversight.

Architecture: ![request and data flow](docs/architecture.svg) — also `docs/architecture.html`.

```bash
npm run verify    # tsc --noEmit && node --test
npm run build     # writes .next-build, so it can run with the dev server up (npm run clean resets both)
npm run lint:design       # impeccable detect over src/app, via npx (no install)
npm run lint:screens      # render the 7 pages into .design-scan/ and run the element rules on them
# Hallmark's floor gate is not vendored here (it is a third-party skill). Run it from a checkout:
#   npx skills add nutlope/hallmark -g
#   node ~/.claude/skills/hallmark/scripts/sloplint.mjs src/app docs/architecture.html --tier floor
```

## Known shortcuts and upgrade triggers

Harvest with `grep -rn "shortcut:" src prisma`. Currently: default ingest writes one listing per
model unless `--endpoints` is run; capability flags are booleans until the vocabulary needs to be
user-extensible; price sorts aggregate instead of using a rollup column until listings pass ~20k;
keyset paging has no backward pages. Each is written next to the code it describes, with the
condition that would make it the wrong choice.

## AI tooling

Per the assignment's rules, AI assistance was used for development. To be explicit about the
boundary:

- **Used for:** boilerplate, config, diff review, and reference while debugging SQL.
- **Decided and written by me:** the schema and migrations, the model×provider listing and its
  normalisation, the filter/sort/cursor query, the ingest pipeline, the API contracts, and the
  reasoning in `docs/decisions/`.
- **Not used:** Lovable, Bolt.new, Base44, Replit AI app generation, Firebase Studio or Google AI
  Studio generated apps — or any prompt-to-app generator. No managed no-code runtime, hosted
  preview or one-shot scaffold was used. This is an ordinary Next.js + Prisma repository that runs
  from `npm install`.
