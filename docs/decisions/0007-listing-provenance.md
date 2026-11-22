# 7. A listing records where it came from

**Status:** accepted · **Date:** 2026-11-21 · **Affects:** `prisma/schema.prisma`, `src/lib/ingest/*`, `src/lib/query.ts`, `/providers`, `/models/{lab}/{slug}`

## Context

Ingest writes a `ModelListing` from two places. If `--endpoints` was run and the model has endpoint
records, each one becomes a listing with a price, a quantisation, a latency and an uptime. If not, the
model's own catalogue entry (`pricing`, `top_provider`) becomes a single listing so the row still has a
price. Both rows live in the same table, because both are "this model, this price, this context".

Nothing said which was which, and the UI found out the hard way:

- `/providers` ranked **`Unknown provider`** first, with 476 listings. That row is not a company; it is
  the name written when `top_provider.name` was absent.
- The same fallback rows carry `uptimePct = null`. Averaging them with `Number(null)` produced `0`, and
  `0` is finite so the filter kept it: every provider displayed **"0.00%" availability** — a
  measurement of zero rather than the absence of one. This app has one rule about exactly that
  confusion, and the aggregation broke it anyway.
- `/models` said "Providers 1" for a model that has a price and no evidence of anyone serving it.

## Decision

`ModelListing.source` is an enum, `CATALOGUE | ENDPOINT`, written by the normaliser and indexed. The
migration backfills it from the shape of the existing rows (an endpoint-derived listing always has a
name plus at least one of quantisation, status, latency, uptime), so the column is populated without a
re-ingest, and the re-ingest then confirms it.

`GET /api/models/{lab}/{slug}` adds `fromEndpoint` per listing; the API keeps every listing, because a
listed price is a real fact and a client may want it.

The screens split on it:

| | CATALOGUE | ENDPOINT |
|---|---|---|
| `/models/{lab}/{slug}` | "Catalogue price, not an offer from a provider", one line | the table, `cheapest` marked, sorted by input price |
| `/providers` | excluded, with the count stated: `476 catalogue-level prices` | the directory, averages over non-null samples with `N of M` printed |
| `GET /api/models` | not counted | `providerCount` counts distinct providers with an endpoint listing |
| `/api/stats` → `providers` | — | providers having at least one endpoint listing (74 of 75 rows) |

## What it costs

The row count is the same (768 listings), and 476 of them say "nobody measured this". So the numbers
went down and the claim they make went up: `providers 75 → 74`, and a model like
`openai/gpt-3.5-turbo-0613` now reads "Provider endpoints 0" instead of "1 provider".

## Why not infer it instead

`uptimePct IS NULL` is a decent proxy today and a lie the first time a provider reports an uptime of
exactly zero, or a run leaves columns stale. Inferring meaning from empty cells is how the `0.00%`
above was produced in the first place: the emptiness was real, the reading of it was not.
