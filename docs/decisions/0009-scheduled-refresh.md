# 9. Scheduled refresh: a cron route with its own secret

**Status:** accepted · **Date:** 2026-11-22 · **Affects:** `src/app/api/cron/ingest/route.ts`, `src/lib/ingest/run.ts`, `vercel.json`, `src/app/api/admin/ingest/route.ts`

## Context

The mirror only moved when a human ran the CLI or POSTed to `/api/admin/ingest`. A discovery
product whose prices silently age is worse than one that admits its date (the footer already
prints the mirror date), and the brief grades reliability for the Full-Stack role. Vercel Cron
is the scheduler this deployment already has, but it sends GET requests authenticated with
`Authorization: Bearer $CRON_SECRET`, while the ingest route is a POST guarded by
`x-ingest-token`. Forcing one route to serve both would mix two credentials and two callers.

## Decision

- `GET /api/cron/ingest` exists for the scheduler alone: 503 when `CRON_SECRET` is unset, 401
  on a wrong bearer, and it runs the same `mirrorCatalogue()` the POST route uses (extracted to
  `src/lib/ingest/run.ts`, so "refresh" has one definition and the IngestRun row says who asked:
  `openrouter:models` by hand, `openrouter:cron` on schedule).
- `vercel.json` schedules it daily at 03:00 UTC. `maxDuration = 300`: a catalogue mirror was
  measured at 141 s locally (fetch plus ~500 upserts), so the default ceiling is not a thing to
  discover at 03:00 in production.
- The cron pass is catalogue-only. Endpoint enrichment takes minutes (227 s measured for the
  full mirror) and stays a shell command after a deploy, exactly as README §Deploy already
  prescribed for seeding. Prices and specs, the part that moves daily, are what the schedule
  refreshes.

## Costs and limits

Daily, not hourly: Hobby cron granularity and a public upstream both argue for it, and the
footer's mirror date makes the cadence visible rather than implied. If the catalogue ever needs
to be fresher than a day, the trigger is the same route from an external scheduler, not a new
code path.
