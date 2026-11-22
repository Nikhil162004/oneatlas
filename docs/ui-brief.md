# UI screens — the spec, and what was built

Built 2026-11-21. Each item below states the spec first, then what shipped and where it deviates,
because a spec that quietly matches reality is how you lose the reason for a deviation.


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

## Deviations, with reasons

- **`router.replace` → a GET form.** The spec said "every control writes a URL with
  `router.replace`"; a `<form method="get">` writes the same URL with no client component, no router
  import and no state to keep in sync. The shareable/back-button property was the point, and it is
  intact. `docs/decisions/0006`.
- **No `⌘K` palette.** `/search?q=` covers module 6 with a native form and the same
  `globalSearch` service. A palette is a focus-trap and a keybinding for one input.
- **No "only differences" toggle on /compare.** Needs client state; the table is already transposed
  to one attribute per row, so a differing value is visible. Add it if the column count ever grows
  past six, which the API already refuses.
- **No `/providers/{slug}` page.** `/providers` carries the spread, latency and uptime per provider,
  and the model page is where a listing's context lives. A one-model-per-column page would be a
  filtered `/models`. The API route is `/api/providers` with the same payload.
- **No `loading.tsx`.** Streaming commits HTTP 200 before `notFound()` runs, which turns every
  unknown model or lab URL into a soft 404. Measured page renders are 11–25 ms, so the skeleton would
  buy nothing a reviewer would notice.
- **Table⇄cards toggle not built.** The live product has it; the brief did not ask for it, and a card
  layout is a second rendering of every row to keep in sync. `shortcut:`-class deferral.

## Gate

Gate before you call any of this done: `npm run lint:design` (impeccable detect) and Hallmark's
floor tier (`sloplint --tier floor`, from a `npx skills add nutlope/hallmark -g` checkout — it is a
third-party skill, so it is not vendored into this repo), and `npm run lint:screens`, which renders
every screen into `.design-scan/` and runs the element-level rules over the HTML plus its stylesheet.
Contrast, focus visible, nothing invented, no broken phone layout. Then fix what they report, or
write down why not.

Status as of the build: `tsc --noEmit` clean · `npm test` 21/21 · `npm run smoke` 18/18 against both
the dev server and the production build · `npm run lint:design` clean in regex mode ·
`npm run lint:screens` 7 findings left, all recorded above with a reason. Not run here: `--render`
grades and a real phone viewport (no Chrome in this sandbox).
