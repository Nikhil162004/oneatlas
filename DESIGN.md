# OneAtlas — design doc (written before the code)

Full Stack Engineer role. This file is the scope contract: what I build, what I cut, and why.

## Product

A discovery and intelligence platform for AI models: find one, compare two, see who serves it and
what it costs, and rank them by benchmark. Reference points are OpenRouter, RouterPlus and LiteLLM;
the live product is oneatlas.dev (1,118 models / 8,274 API listings / 223 providers / 78 labs).

## The one observation that sets the schema up

Listings outnumber models ~7:1. Price, context ceiling, quantisation, latency and uptime are
properties of a **(model, provider, endpoint)** triple, not of a model. So `ModelListing` is the
centre of the model and every price shown in the UI is an aggregate over it. Get this wrong and the
compare screen cannot show "same model, cheaper elsewhere" — which is the product's reason to exist.

## Scope, mapped to the six required modules

| Module | Implementation |
|---|---|
| 1 Discovery & search | `GET /api/models` with `q, lab, provider, type, capabilities[], minContext, maxPrice, free, hideDeprecated, sort, dir, cursor, limit`; SQL filters + `pg_trgm` ILIKE; `/models` screen keeps all of it in the URL |
| 2 Detail pages | `GET /api/models/{lab}/{slug}`; specs, per-provider price table, modalities/capabilities, benchmark strip |
| 3 Comparison | `GET /api/models/compare?ids=` (2–6, GET so the selection is shareable); row-oriented matrix |
| 4 Rankings & benchmarks | `GET /api/rankings?benchmark&category&type&minContext`; offset paging by rank |
| 5 Labs & providers | `GET /api/labs`, `/api/labs/{slug}`, `/api/providers`; releases derived by grouping models on `releaseDate` |
| 6 Product experience | shared nav, `GET /api/search` global lookup, responsive table, loading/empty/error states |

## Data

One public upstream, no auth, no scraper: `GET https://openrouter.ai/api/v1/models` (476 models with
pricing, context, modalities, `supported_parameters`, `created`, `expiration_date`, benchmark indices).
Per-provider listings come from `/api/v1/models/{author}/{slug}/endpoints` and are an **opt-in**
`--endpoints` pass, because that is one request per model.

`shortcut: default ingest writes one listing per model from top_provider; run --endpoints when the
detail page needs the full provider spread.`

Generated/mock data is allowed by the brief; the rule I hold to is that **all of it reaches the UI
through Postgres and the API**, never as a constant in a component.

## Explicitly not building

Auth, users, saved comparisons, playground/inference, billing, i18n, a rate limiter, a search
engine, a queue, a Release table, denormalised price rollups, a monorepo, and any admin UI.
Each is either not asked for or is a cost that pays nothing at this size. Upgrade triggers for the
interesting ones are in `docs/decisions/`.

## Interface

Seven screens, no client components. Filters, sort, cursor, compare selection and benchmark are
query-string state submitted by native forms, so a screen is a function of its URL and the URL is the
same one `GET /api/models` accepts — `docs/decisions/0006`.

**Tokens** (`src/app/globals.css`, and nowhere else): `--bg --surface --surface-2 --fg --muted
--faint --line --line-2 --accent --accent-ink --warn --r --r-sm --hair --ease`. Depth is a surface
step plus a hairline at 9% of the text colour: no shadows beyond `0 1px 2px rgb(0 0 0/.05)`, no
glows, no hue-to-hue gradient, no blurred blob. Type is one webfont — Archivo at 400/500/600 — over
the platform mono stack for figures; nothing goes heavier than 600 because hierarchy is size and
colour, not weight. Sizes are 12/13/15/17/18/24/34, spacing 4/8/12/16/24/32/48, one easing curve
`cubic-bezier(.22,1,.36,1)`, transitions name the property they animate and last 120–150 ms.

Two rules the linters enforce and that are easy to break by accident:

- **No colour literal outside the token block.** A screen that wants a tone adds a token.
- **Unknown is an em dash, never 0 or "Free".** `format.priceLabel(null)` is `\u2014`;
  `format.priceLabel(0)` is `Free`. The Free filter and the price sort depend on that difference, and
  so does a reviewer's ability to tell "we did not mirror this" from "this costs nothing".

**Visual interest is data, not decoration.** Coverage, benchmark scores, a lab's release cadence and
each provider's price spread are drawn as bars whose only other encoding is the number beside them.
The comparison table marks which rows actually differ, server-side, so the feature needs no toggle.
Everything that is not a value was deleted: no status pills, no icon tiles, no eyebrow labels, no
entrance animation, no hover lift on a card.

## Definition of done

Deployed on Vercel + Neon with a seeded database; `npm run verify` and `npm run smoke` green; every
screen has an empty state and an error state, and answers with the right status code (there is
deliberately no `loading.tsx`: a streamed shell turns every 404 into a soft 200); `EXPLAIN` output for
the filtered list query in the README; 5–10 min Loom that explains the listing table, the keyset
cursor and why there is no search engine.

## Method note

Built under the Ponytail ruleset (`AGENTS.md`): smallest complete change, never cutting validation,
error handling, security or accessibility. Reviewed with `impeccable detect`, `critique` and
`harden`, and with Hallmark's `sloplint --tier floor` on the UI. Results are recorded in
`docs/review-log.md`.
