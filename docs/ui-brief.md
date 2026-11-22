# UI screens to build (yours — the spec, not the code)

Six screens. Every one of them gets: loading state, empty state, error state, keyboard focus,
and a mobile layout that is designed rather than merely unwrapped. Data arrives only through
`/api/*` from a server component; no module-scope arrays.

1. `/models` — the table. Columns: model, lab, providers count, context, output, price in/out per
   1M, capabilities, released. Filters (lab, provider, type, capabilities, min context, hide
   deprecated, free) and sort **live in the URL**: read them from `searchParams` on the server, and
   every control writes one with `router.replace`. That is the whole integration story: shareable,
   back-button-correct, and the server does the filtering. "Load more" passes `cursor` back.
2. `/models/[lab]/[slug]` — specs grid, then a providers table (price, context, quantisation,
   latency, uptime), then a benchmark strip. Anchor `#providers` like the live site.
3. `/compare?ids=` — rows are attributes, columns are models. Add/remove chips; "only differences"
   toggle computed client-side from the payload.
4. `/rankings` — benchmark picker + category filter, rank column first.
5. `/labs`, `/labs/[slug]` — directory cards, then lab page with the release cadence (month → count).
6. `/providers`, `/providers/[slug]` — model count, price spread, avg latency/uptime.
Plus `⌘K` global search over `/api/search`, built from a native `<dialog>` and one `<input>` — no
palette library.

Gate before you call any of this done: `npm run lint:design` (impeccable detect) and Hallmark's
floor tier (`sloplint --tier floor`, from a `npx skills add nutlope/hallmark -g` checkout — it is a
third-party skill, so it is not vendored into this repo). Contrast, focus visible, reduced motion,
nothing invented, no broken phone layout. Then fix what they report, or write down why not.
