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
| 1 Discovery & search | `GET /api/models` with `q, lab, provider, type, capabilities[], minContext, maxPrice, free, hideDeprecated, sort, dir, cursor, limit`; SQL filters + `pg_trgm` ILIKE; `/models` screen exposes all of it: every parameter has a control in the one GET form (lab and
  provider as datalists), and each active one shows as a removable chip above the table |
| 2 Detail pages | `GET /api/models/{lab}/{slug}`; specs, per-provider price table, modalities/capabilities, benchmark strip,
  a cost estimator that re-prices every provider for a token count, a copyable curl for the record, and
  alternatives (same type, shared capabilities, cheapest first; also `GET /api/models/{lab}/{slug}/alternatives`) |
| 3 Comparison | `GET /api/models/compare?ids=` (2–6, GET so the selection is shareable); row-oriented matrix; any model
  can be found and added from the picker's search, not only recent releases |
| 4 Rankings & benchmarks | `GET /api/rankings?benchmark&category&type&minContext&view` (`view=value` ranks score per dollar of cheapest input); the screen offers benchmark chips plus
  model-category and benchmark-family selects; offset paging by rank |
| 5 Labs & providers | `GET /api/labs`, `/api/labs/{slug}`, `/api/providers`, `/api/providers/{slug}`; releases derived by grouping
  models on `releaseDate`; labs and providers both have profile pages (models, prices, release cadence /
  reliability), and every directory row also links back to `/models?provider={slug}`, so the directory is a
  starting point and not a dead end |
| 6 Product experience | shared nav, `GET /api/search` global lookup (also the ⌘K palette: the same groups, keyboard-first), responsive table, loading/empty/error states; a compare tray (slugs in localStorage, resolved by `/api/models/compare` on /compare, never a second source of truth) collects picks from model rows and alternative cards |

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

Ten screens; the four with controls are client islands over a server first paint
(`docs/decisions/0008`). Filters, sort, cursor, compare selection and benchmark are query-string
state, applied in place and written to the URL, so a screen is a function of its URL and the URL is the
same one `GET /api/models` accepts — `docs/decisions/0006`.

**Tokens** (`src/app/globals.css`, and nowhere else): `--bg --surface --surface-2 --fg --muted
--faint --line --line-2 --accent --accent-ink --warn --r --r-sm --hair --ease`. Depth is a surface
step plus a hairline at 9% of the text colour: no shadows beyond `0 1px 2px rgb(0 0 0/.05)`, no
glows, no hue-to-hue gradient, no blurred blob. Type is one webfont — Archivo at 400/500/600 — over
the platform mono stack for figures; nothing goes heavier than 600 because hierarchy is size and
colour, not weight. Sizes are 12/13/15/17/18/24/34 (plus 40/44 for the two display figures), spacing
4/8/12/16/24/32/48, one easing curve
`cubic-bezier(.22,1,.36,1)`, transitions name the property they animate and last 120–150 ms.

Two rules the linters enforce and that are easy to break by accident:

- **No colour literal outside the token block.** A screen that wants a tone adds a token.
- **Unknown is an em dash, never 0 or "Free".** `format.priceLabel(null)` is `\u2014`;
  `format.priceLabel(0)` is `Free`. The Free filter and the price sort depend on that difference, and
  so does a reviewer's ability to tell "we did not mirror this" from "this costs nothing".

**One breakpoint, and it changes the structure.** Below 860px a `.stack-sm` table stops being a
table: `thead` and the wrapper's frame go away, each row becomes a card and each cell a
label/value line whose label comes from `data-label`. A 10-column price table cannot be read at
390px by shrinking it, and a sideways scroll region inside a scrolling page is precisely what feels
broken on a touch screen. `/compare` keeps horizontal swiping instead, because comparing columns
side by side is the whole feature there: snap points plus a sticky, opaque attribute column that
travels with you. Sorting stays reachable on a phone through the form's Sort field, since the
clickable headers are hidden. `npm run smoke` asserts every stacked cell carries a label, because an
unlabelled value is this pattern's silent failure.

Touch and browser defaults: 44px targets and 16px field text under `pointer: coarse` (iOS zooms the
page when a focused input is smaller than 16px, and that zoom is what makes a form feel broken);
`color-scheme: dark` plus `theme-color` so a phone does not paint a white overscroll page behind a
black document; `100svh` instead of `100vh`; `env(safe-area-inset-*)` gutters with
`viewport-fit=cover`; `touch-action: manipulation` on pressable controls; `overscroll-behavior-x:
contain` and thin dark scrollbars on anything that does scroll sideways; `scroll-padding` so
`#providers` lands below the sticky header, with `scroll-behavior: smooth` off under
`prefers-reduced-motion`.

**Visual interest is data, not decoration.** Coverage, benchmark scores, a lab's release cadence and
each provider's price spread are drawn as bars whose only other encoding is the number beside them.
The comparison table marks which rows actually differ, server-side, so the feature needs no toggle.
Everything that is not a value was deleted: no status pills, no icon tiles, no eyebrow labels, no
entrance animation, no hover lift on a card.

## Interaction, and the arithmetic it depends on

Four things make a table feel like a product rather than a dump, and each one is a piece of arithmetic
in `globals.css` rather than a taste choice:

- **A pinned column header.** `thead th { position: sticky }` only works if nothing between it and the
  viewport is a scroll container - so `.tablewrap` switches from `overflow-x: auto` to `overflow-x:
  clip` at 1200px, which is 1000 (widest table) + 64 (shell gutters) + ~15 (classic scrollbar) with
  slack, rounded up to the next multiple of 8. At a threshold picked as "wide enough to fit" (1064) a
  2px table border and a Windows scrollbar would have silently clipped the last column, and `clip`
  offers no way to scroll it back. Below 1200 the wrapper scrolls sideways and the header moves with
  it, because losing a column is worse than losing the pin.
- **The row itself is the target.** One link per row, whose `::after` is absolutely positioned over the
  `tr`; so the `tr` is `position: relative`, which is only a containing block with
  `border-collapse: separate` (that is what the pinned header already required, so the two choices
  share a cause). Nested links take `z-index: 2` or they become unclickable. Tab stops per row: one.
- **Every filter is removable.** `.subbar` holds the count, the sort in force and one chip per active
  parameter; a chip's `href` is the same URL minus that one key (`hrefWith`), so "clear this" costs no
  JavaScript and cannot disagree with the form. A key that is a list (`capabilities`) splits into one
  chip per value and re-joins the rest; a search term containing a comma deliberately does not split,
  because half a query is not a filter.
- **Sticky offsets are arithmetic, not pixels.** `--chrome-row` + `--chrome-top` + 12 = `--chrome-h`,
  and the table header pins at `--pin-top` (`--chrome-h + --subbar-h` on the one screen that also pins
  a summary line). The app header is one flex row of declared height, never wrapped, which is what
  makes the number true. `+1px` is its bottom border.

Numbers in a column align on their decimal point, so `priceLabel` always prints two decimals
(`$0.50 / $10.00`, never `$0.5 / $10`) and `contextLabel` does the opposite - a context window is a
magnitude, so 262,144 is `262K`, not `262.14K`. `0` is `Free`, unknown is `—`, and both are pinned in
`tests/format.test.ts`, because those three strings are the difference between a table that lies and
one that does not.

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
