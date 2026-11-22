# OneAtlas — AI model discovery & intelligence platform

Full Stack Engineer submission. **Live URL:** _fill in_ · **Repo:** _fill in_ · **Loom:** _fill in_

## What it is

MVP of a model-discovery product: browse and filter a catalogue of AI models, read a full spec
sheet per model, compare up to six side by side, rank by benchmark, and browse the labs and
providers behind them. Data is ingested from a public catalogue into Postgres and reaches every
screen through the API — there is no fixture array in the frontend.

## Stack

Next.js (App Router, server components) · React · TypeScript · TailwindCSS · Next.js route handlers ·
Zod · PostgreSQL · Prisma. Deployed on Vercel + Neon.

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
src/app/api/*               nine endpoints, see docs/DESIGN link below
tests/                      node:test over the pure layer: npm test
docs/                       DESIGN.md, decisions/0001-0005, ui-brief.md, review-log.md
```

## Reading order for a reviewer

1. `DESIGN.md` — scope, and the list of things deliberately not built.
2. `docs/decisions/0001` — why `ModelListing` is the centre of the schema.
3. `docs/decisions/0005` + `src/lib/query.ts` — the keyset cursor, and why one table owns "sorted".
4. `tests/query.test.ts` — the placeholder-invariant test that keeps hand-built SQL honest.
5. `docs/decisions/0003` — why search is `pg_trgm` and not Meilisearch.

## Verify — what is actually green, and what is not

Ran on 2026-11-21 in the dev sandbox (Node 20, no Postgres, no Chrome):

```
npx prisma validate                       clean
npx tsc --noEmit                          clean
npm test                                  19/19 pass
npx next build                            clean, 10 routes
npx tsx scripts/ingest.ts --offline fixtures/or_models_full.json --dry
                                          476 records in → 476 models, 60 labs, 476 listings,
                                          7 benchmarks / 756 scores, 0 issues
npx tsx scripts/ingest.ts --limit 12 --endpoints --dry
                                          12 models → 31 listings across 8 providers
node tools/.../sloplint.mjs --tier floor  2 findings left, both skipped on purpose (see docs/review-log.md)
npx impeccable detect src/app             no findings in regex mode
```

**Not verified here, and you must run it:** anything needing a database (`prisma migrate deploy`,
the real `EXPLAIN` plan, the ingest write path against Postgres) and the browser-grade scans
(`impeccable detect http://localhost:3000`, `sloplint --render`) — this sandbox has no Postgres and
no Chrome, so claiming those would be a guess. See `docs/review-log.md` for every finding, the two
bugs the tools caught in my own code, and why each skip is a decision rather than an oversight.

Architecture: ![request and data flow](docs/architecture.svg) — also `docs/architecture.html`.

```bash
npm run verify    # tsc --noEmit && node --test
npm run lint:ui   # Hallmark floor gate on the UI sources
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
