# 8. Client islands for in-place refresh; the URL is still the state

**Status:** accepted · **Date:** 2026-11-22 · **Affects:** `src/app/{models,rankings,compare,search}/page.tsx`, `src/app/layout.tsx`, `src/components/*Explorer.tsx`, `src/components/SiteSearch.tsx`
**Supersedes:** the "no client JavaScript" half of `docs/decisions/0006`. The "URL is the state" half stands unchanged.

## Context

0006 made every control a native form field or a link, so a filter change was a document load:
the browser blanked, scrolled to the top, and repainted the chrome around a 15 ms server render.
That is correct and shareable, and it feels like a different website on every click. The request
that prompted this decision, verbatim: "if i click on button it does not refresh entire project
just refresh particular component."

## Decision

The four screens with controls (/models, /rankings, /compare, /search) are now server-rendered
pages carrying one client island each (`ModelsExplorer`, `RankingsExplorer`, `CompareExplorer`,
`SearchExplorer`), and the header search is a small client component (`SiteSearch`).

- **First paint is still the server's.** A page parses its query with the same Zod schema, calls
  the same service, and renders real rows. The island mounts on those rows and fetches nothing
  until the first interaction, so view-source, crawlers and `npm run smoke` see the same document
  they saw under 0006 (all 28 smoke checks pass unchanged, including the ones asserting the
  rendered `checked` checkbox, the hidden benchmark field, and chip hrefs).
- **Interactions fetch the screen's own API.** Apply, a filter chip, a sort header, Next: the
  island builds exactly the query string the native form would have submitted, calls
  `GET /api/models?...` (resp. rankings/compare/search), and replaces only the results region.
  The old rows dim (`[data-loading]`) instead of blanking; a failed refresh keeps the previous
  rows and says so.
- **The URL is still the state.** Every in-place update writes its query with
  `history.pushState`; `popstate` re-reads the URL and fetches what it says. Copy the URL
  mid-filtering and the server renders that view. There is still exactly one definition of a
  valid query: the route's schema, which now also validates every client fetch for free.
- **Progressive enhancement is kept, deliberately.** Forms keep `method="get" action="..."`
  and query-only anchors keep real hrefs; the island intercepts the click/submit when hydrated.
  With JavaScript off, the site behaves as it did under 0006. Query-only anchors are plain
  `<a>`, not `<Link>`: an intercepted `<Link>` would also soft-navigate, remounting the island
  the fetch was about to update.

## What this caught while being built

- A cursor minted under one sort is foreign to another (`sort=context` + a `released` cursor
  makes Postgres cast a timestamp to `int`, a 503). The sort links already dropped the cursor,
  but during a fetch the pager briefly rendered a new-sort/old-cursor href, which Next then
  *prefetched*. The island now nulls `nextCursor` the moment a load starts.
- Verification needs a browser, not just HTTP: the interaction suite (headless Chromium,
  playwright-core) marks `window`, clicks Apply/chip/sort/Next/chips/Compare/Remove, types in
  both search boxes, and asserts the marker survives, i.e. no document load occurred. 11 checks,
  run 2026-11-22 against the production build. It is not wired into `npm run smoke` because the
  repo has no browser dependency; the HTTP contract stays guarded there.
- Two test-harness traps worth remembering: `input[name="q"]` matches the header search before
  the page's, and an edit verified in parallel with a read can look unapplied. Neither was an
  app bug; both cost a debugging round.

## What it costs

~8 kB of first-load JS on the controlled screens (a Next page is 106-111 kB total), hydration
work a plain document did not need, and a second rendering path per screen that must not drift
from the first. The drift risk is bounded: both paths render from the same service/API response
shape, and smoke pins the server path's HTML while the browser checks pin the client path's
behaviour. Screens without controls (home, labs, providers, detail, /api) stay server-only.
