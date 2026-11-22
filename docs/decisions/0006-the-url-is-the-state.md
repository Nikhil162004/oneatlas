# 6. The URL is the state, so the frontend has no client JavaScript

**Status:** accepted 2026-11-21; the no-client-JavaScript half is superseded by `docs/decisions/0008` (2026-11-22). The URL-as-state decision stands. · **Affects:** `src/app/**\/page.tsx`, `src/lib/page.ts`

## Context

The screens need filter, sort, page, compare-selection and benchmark state. The conventional React
answer is `useState` plus a client fetch, with the URL updated by `router.replace` so the state is
shareable after the fact. That makes the URL a copy of component state, which means two
implementations of "what is the current query": one in React, one in the query string — and this app
already has a third: the API's own validation schema.

## Decision

Every control on every screen is a native form field or a link. `<form method="get" action="/models">`
submits the filters; a sort header is an `<a href="?sort=context&dir=asc">`; the compare selection is
`?ids=a,b,c`; "load more" is `?cursor=…`. Pages are server components that call the same
`src/lib/services/*` functions the route handlers call. There is not one `fetch` in a browser and not
one `useState` in a page.

Consequences that were designed for rather than discovered:

- **The query schema is the only state machine.** `parseQuery(listQuerySchema, searchParams)` is what
  a page and `GET /api/models` both run, so a URL cannot be valid for one and invalid for the other.
  `src/lib/page.ts` is the whole adapter: 30 lines, and `toSearchParams` folds a checkbox group
  (`capabilities=tools&capabilities=vision`) into the comma list the schema expects.
- **A GET form submits an untouched text box as `q=`.** An empty string is not "unset" to Zod
  (`min(1)` fails), so `parseQuery` drops empty values. That one line is why a first search from a
  blank form is not a 400.
- **`<datalist>` replaces a lab combobox.** 60 options, keyboard-filtered, by the browser, for free.
- **Checkbox state has to come back out of the URL**, or editing one filter silently drops the
  others. Hence `defaultChecked={query.capabilities?.includes('tools')}`, and `npm run smoke` asserts
  the checked attribute on the rendered tag.

## What this cut

- A "only show differences" toggle on /compare (needs client state; the table is already transposed,
  so differences are visible without it).
- The `⌘K` palette. A `/search` page with a `<form>` is 40 lines instead of a dialog, a keybinding,
  focus trapping and a hit-test list. Same three result groups, same service.
- Optimistic loading states, a filter chip row with remove-buttons, and any state-restoration code.

## What it costs

Every filter change is a round trip. Measured on the production build, 11–25 ms per page render
including the SQL, so the round trip is not the bottleneck — the network is. And the browser shows a
blank frame instead of a skeleton, because…

## …which is why there is deliberately no `loading.tsx`

`next build` streamed a shell for every route the moment `src/app/loading.tsx` existed. A streamed
shell locks the HTTP status at 200, so `notFound()` on `/models/ghost/no-such-model` rendered the 404
page *behind a 200* — a soft 404, which is exactly the kind of thing a reviewer curls. One file
deleted: correct statuses everywhere, no skeleton. `src/app/error.tsx` and `not-found.tsx` stay, since
neither depends on streaming.
