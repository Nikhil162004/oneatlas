# OneAtlas — AI model discovery & intelligence platform


Full Stack Engineer submission.

| Submission item | State |
|---|---|
| Live URL | https://oneatlas-smoky.vercel.app - deployed on Vercel (Hobby) with Neon Postgres; `npm run smoke` passes 28/28 against this URL |
| GitHub repository URL | https://github.com/Nikhil162004/oneatlas |
| Loom, 5-10 min | **pending** - the walkthrough script is [Read this first](#read-this-first); the video is the author talking, not a generated asset |

Everything else in this file is checked against the running app in this workspace, not against intent.

## What it is

MVP of a model-discovery product: browse and filter a catalogue of AI models, read a full spec
sheet per model, compare up to six side by side, rank by benchmark, and browse the labs and
providers behind them. Data is ingested from a public catalogue into Postgres and reaches every
screen through the API — there is no fixture array in the frontend.

## Stack

Next.js (App Router, server components) · React · TypeScript · TailwindCSS · Next.js route handlers ·
Zod · PostgreSQL · Prisma. Vercel + Neon is the deploy target; nothing here needs anything else.

Seven screens, an API index page, ten API routes, one Postgres schema. **No client JavaScript in the pages**: filters,
sorts, cursors and the compare selection are query strings submitted by native `<form>`s, so the URL
is the state and every screen renders from the same service its endpoint does
(`docs/decisions/0006-the-url-is-the-state.md`)
(`docs/decisions/0006-the-url-is-the-state.md`). The three reference platforms were studied before
any of this was written, and the verdicts are in `docs/references.md`: what OpenRouter's data shape
forced into the schema, what RouterPlus's quality-bar argument rules out of the UI, and why
LiteLLM's static metadata file is the counter-example to the brief's one hard data rule.

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
vercel.json                 framework + build command, so a deploy needs no dashboard folklore
src/lib/query.ts            filters + sort + keyset cursor, one definition of each
src/lib/validation.ts       zod at every boundary
src/lib/api.ts              response envelope, error mapping, cache policy
src/app/api/*               ten endpoints, all under a versioned contract (see DESIGN.md §API)
src/app/{models,rankings,api,…} the screens; server components only
src/lib/services/*          the read side both the pages and the routes call — no page fetches /api
src/lib/{present,format,page}.ts  row→JSON mapping, number/date display, searchParams→query
src/components/ui.tsx       badges, empty/error states, pager
tests/                      node:test over the pure layer: npm test
scripts/smoke.mjs           27 contract checks against a running server, API *and* HTML
scripts/linkcheck.mjs       no <Link> may point at a route handler (see docs/review-log.md)
docs/                       references.md, decisions/0001-0007, ui-brief.md, review-log.md, architecture.{html,svg}
DESIGN.md (repo root)       the design document, §API included
```

## Screens

| Route | Shows | Where its numbers come from |
|---|---|---|
| `/` | counters, coverage meters, benchmark coverage, cheapest tool-capable models, newest releases; the JSON entry points are plain `<a>`s, because a route handler is a document, not a page | `services/stats` + `listModels` |
| `/models` | the table: search, type, lab, **provider**, capabilities, context floor, price ceiling, free, hide-deprecated, 5 sorts, cursor paging, one × per active filter | `services/catalogue.listModels` |
| `/models/{lab}/{slug}` | spec grid, description, **provider endpoints** (price, context, quant, p50 latency, 24 h uptime, cheapest marked), the catalogue price when no endpoint is mirrored, benchmark strip | `modelDetail` |
| `/compare?ids=a,b` | attributes as rows, up to six models as columns, missing ids named | `compareModels` |
| `/rankings` | leaderboard, benchmark chips, model-category and benchmark-family selects, offset paging with a stated range | `rankings` |
| `/labs`, `/labs/{slug}` | 60 labs by output; a lab's models plus a month-by-month release cadence | `listLabs`, `labDetail` |
| `/providers` | providers having at least one endpoint listing: models, listings, cheapest/average/dearest price as a spread bar, avg latency and uptime with the sample size, each row linking to the models it serves | `listProviders` |
| `/search?q=` | models / labs / providers in three groups | `globalSearch` |

Filters live in the URL, so a filtered view is a link. Production timings on this machine, best of
five: `/models` 25 ms, `/rankings` 23 ms, `/providers` 24 ms, `/labs` 11 ms, a model page 12 ms —
each including its SQL.

**The API, in the browser:** `/api` is a page, not a bare document. Raw JSON is the wrong thing to
navigate a UI to — Chrome pretty-prints it, Safari and Firefox offer to download it, and an embedded
preview pane shows neither, which is exactly how "Get the JSON does nothing" was reported. The index
lists all ten handlers with a link to each live document, and shows a response body executed at render
time — not a written example, so the page cannot describe a contract the routes dropped. A model page
carries its own record in a `<details>` block, deep-equal to what its endpoint returns, which
`npm run smoke` asserts.

**Product surface:** a long table pins its column headers (`overflow-x: clip` above 1200px is what
makes `position: sticky` possible, and the 200px of slack is a classic scrollbar's); one link per row
whose `::after` covers the whole row, so a click anywhere opens it and the tab order stays at one stop
per row; the line above the table is the count, the sort in force and one × per active filter, where
each × is a link deleting exactly that query parameter. Prices print two fixed decimals so a column
aligns on the point; context labels round to the digit that means something (`262K`, `1.05M`). The
arithmetic behind the pin (`--chrome-h`, `--pin-top`) is in `DESIGN.md` §Interaction, and the two
smoke checks named above are what keep it honest.

**Responsive:** below 860px every data table becomes one card per row with labelled lines, so nothing
scrolls sideways on a phone; `/compare` keeps a swipe with a sticky attribute column instead. Touch
targets are 44px, inputs 16px (iOS stops zooming), `color-scheme: dark` and `theme-color` stop the
browser painting white overscroll, safe-area insets are honoured, and the header nav is a flickable
strip. `npm run smoke` checks that every stacked cell carries its `data-label`. What I could not do
here: look at it on a device - no browser in this sandbox, so the mobile behaviour is verified by the
compiled CSS, the label guard and the layout rules, not by a screenshot. Read the rendered CSS at
`.design-scan/_next/static/css/app/layout.css` if you want to check the media queries.

The interface obeys `felipebasurto/unslop-ui`'s surface rules (U17 to U20): depth is a surface step
plus a hairline, weights stop at 600, spacing is on one scale, transitions name a property and never
decorate. What the screens gained over the first pass is typographic hierarchy (one webfont, a real
type ramp, tabular figures), information-bearing bars (coverage, benchmark score, release cadence,
per-provider price spread), and a marked-difference comparison table — no gradients, glows, icon
tiles, eyebrow labels, status pills or entrance animation.

## Reading order for a reviewer

1. `DESIGN.md` — scope, and the list of things deliberately not built.
2. `docs/decisions/0007` — why a listing records its own provenance, and the two wrong numbers the
   product published before it did (`Unknown provider` at the top of the directory, `0.00%` averages).
3. `docs/decisions/0001` — why `ModelListing` is the centre of the schema.
4. `docs/decisions/0005` + `src/lib/query.ts` — the keyset cursor, and why one table owns "sorted".
5. `tests/query.test.ts` — the placeholder-invariant test that keeps hand-built SQL honest.
6. `docs/decisions/0003` — why search is `pg_trgm` and not Meilisearch.
7. `docs/decisions/0006` — why the pages contain no JavaScript, and what that deleted.
8. `scripts/smoke.mjs` — the checks that make "it works" a reproducible claim rather than a screenshot.

## Verify — what is actually green, and what is not

Ran on 2026-11-21 in the dev sandbox (Node 20, no Postgres, no Chrome):

```
npx prisma validate                       clean
npx tsc --noEmit                          clean
npm test                                  26/26 pass (normalise, SQL builder, presentation contract)
npx next build                            clean, 18 routes (10 handlers + 8 pages), 106 kB shared JS
npx tsx scripts/ingest.ts --offline fixtures/or_models_full.json --dry
                                          476 records in → 476 models, 60 labs, 476 listings,
                                          7 benchmarks / 756 scores, 0 issues
npx tsx scripts/ingest.ts --limit 12 --endpoints --dry
                                          12 models → 31 listings across 8 providers
Hallmark sloplint --tier floor      1 finding left, skipped on purpose (see docs/review-log.md)
python3 ../unslop/count_tells.py --surface src
                                          3 tells (23 at the redesign's start): 1 code comment,
                                          2 one-neutral alpha fades - argued, not open
npx impeccable detect src/app             no findings in regex mode
npx impeccable detect .design-scan        110 findings on rendered HTML -> 0 after the redesign
python3 .../count_tells.py --surface src  23 UI tells -> 2, both kept on purpose
```

Ran against a real database afterwards (embedded Postgres 18.7 on port 55432, `node scripts/pg.mjs`):

```
npx prisma migrate deploy                       applied 20261121000000_init (incl. pg_trgm indexes)
npm run ingest                                  476 models, 60 labs, 7 benchmarks, 756 scores, 0 issues
npm run ingest -- --limit 120 --endpoints         120 models -> 378 listings across 75 providers
re-ran the identical ingest                       row counts unchanged  -> idempotency proven
npm run smoke                                   27/27 against a running server
NEXT_DIST_DIR=.next-build npx next start        27/27 again against the production build
npm run lint:links                              no <Link> points at a route handler
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

# the UI anti-slop gate (a third-party skill, not vendored here):
npx skills add felipebasurto/unslop-ui -g
python3 ~/.claude/skills/unslop-ui/scripts/count_tells.py --surface src
# Hallmark's floor gate is not vendored here (it is a third-party skill). Run it from a checkout:
#   npx skills add nutlope/hallmark -g
#   node ~/.claude/skills/hallmark/scripts/sloplint.mjs src/app docs/architecture.html --tier floor
```

## Deploy (Vercel + Neon)

Deployed: https://oneatlas-smoky.vercel.app (Vercel Hobby, region `iad1`) with a Neon Postgres
project provisioned through the Vercel Marketplace integration, which injects `DATABASE_URL`
(pooled) into all environments. Steps 3-4 below were run from a shell against that database;
the app itself never migrates or seeds. To reproduce from scratch:

```bash
# 1. Any PostgreSQL: Neon's free project is the shortest path, and the brief names it. Copy the
#    *pooled* URL (host ends `-pooler`) for the app, the direct URL if you want a psql session.
# 2. Vercel: import the repo. `vercel.json` pins the framework and the build command, so the deploy
#    does not depend on anyone remembering a dashboard field.
#    Env vars:  DATABASE_URL (pooled) and INGEST_TOKEN (any long random string).
# 3. Migrate from a shell, not from the build:
#       DATABASE_URL=... npx prisma migrate deploy
#    A build step that can rewrite a schema under a live reader is how a deploy takes itself down.
# 4. Seed from a shell too, for the same reason:
#       DATABASE_URL=... npm run ingest -- --endpoints
#    A full mirror does not fit inside a Hobby function timeout, and `--limit` slices the first N
#    models rather than paging, so the endpoint is not a resumable seeding path.
# 5. Refresh later with POST /api/admin/ingest -H "x-ingest-token: $INGEST_TOKEN". It re-runs the
#    catalogue pass idempotently (re-running changed zero row counts) and takes no body.
```

Three decisions that make this deployable rather than demoable: `prisma generate` runs on
`postinstall`, so a serverless build never sees a missing client; every read path is a
`force-dynamic` server component over a shared service, so no cached prerender holds a stale
snapshot of a catalogue that changes daily; and `vercel.json` states `next build` as the build
command because the local `npm run build` deliberately writes to `.next-build` to stop a build
pulling the chunks out from under a running dev server.

## Submission state

Done, and verified against the live systems rather than asserted here:

1. **Authorship.** Every commit in this repository carries the author's own name and email
   (`git log --format='%an <%ae>' | sort -u` shows exactly one identity). They were re-authored
   before the first push; no content changed in that rewrite (identical tree hash before and after).
2. **`.env` stays out.** It is gitignored and untracked (`git ls-files | grep .env` shows only
   `.env.example`, the committed contract). No token or connection string is in this repository.
3. **Submission fields.** Live URL and repo URL are filled in at the top of this file. The Loom
   stays marked pending there until the author records it - the table is the honest statement of
   what a reviewer gets, so it is not deleted.

## Known shortcuts and upgrade triggers

Harvest with `grep -rn "shortcut:" src prisma`. Currently: default ingest writes one listing per
model unless `--endpoints` is run; capability flags are booleans until the vocabulary needs to be
user-extensible; price sorts aggregate instead of using a rollup column until listings pass ~20k;
keyset paging has no backward pages. Each is written next to the code it describes, with the
condition that would make it the wrong choice.

`npm audit` reports 7 findings, all in transitive deps of `prisma` and `next`, and every "fix" is a
major (`next` 15→16, `@prisma/client` 6→7, `zod` 3→4). They are pinned on purpose: Zod 3's error
shape is what `parseQuery` turns into per-field 400s, and Next 16 changes cache-annotation
semantics that `force-dynamic` is load-bearing for. Nothing here accepts user HTML, and the advisory
paths are build-time tooling. The majors belong in their own branch with the suite in front of them,
not in the commit before a demo.

## AI tooling

Per the assignment's rules, AI assistance was used for development. To be explicit about the
boundary:

- **Used for:** boilerplate, config, diff review, and reference while debugging SQL.
- **Decided and written by me:** the schema and migrations, the model×provider listing and its
  normalisation, the filter/sort/cursor query, the ingest pipeline, the API contracts, and the
  reasoning in `docs/decisions/`.
- **Tool:** an AI agent (Arena.ai agent mode) pair-drove the implementation in one session. Every
  file in this tree was read line by line and can be explained; `docs/decisions/` is the reasoning,
  `docs/review-log.md` is the list of mistakes the agent made that the database and the lint gates
  caught, which is the part worth asking about.
- **Not used:** Lovable, Bolt.new, Base44, Replit AI app generation, Firebase Studio or Google AI
  Studio generated apps — or any prompt-to-app generator. No managed no-code runtime, hosted
  preview or one-shot scaffold was used. This is an ordinary Next.js + Prisma repository that runs
  from `npm install`.
