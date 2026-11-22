# Review log — what the tooling said, and what I did

Nothing here is decoration: an unaddressed finding is a bug I chose. Skips carry a reason.

| Tool | Target | Finding | Action |
|---|---|---|---|
| `node --test` (19 tests) | `tokenCount` | test expected `128K → 131072`; code returns `128000` | **Convention decided, not drifted**: suffixes are decimal, because reading `128K` as `131072` invents a number the source did not print. Documented on the function; test corrected to assert the rule |
| `node --test` | keyset cursor | values list included the `LIMIT` parameter, test forgot it | Test was wrong, code right. Asserted the order explicitly: filters → cursor → limit |
| live ingest, `--endpoints` | `rawEndpointListSchema` | `status` is an **integer** upstream; declared `z.string()` → all 12 enriched models silently skipped | Widened to `string \| number`, and logged it as a decision: the failure mode was *loud but wrong-looking* (a whole model dropped). Also added `shortError()` so a ZodError prints one line per bad field instead of a pretty-printed array |
| `impeccable detect src/app` | 13 files | no findings in regex mode; tool states page-level rules (tiny text, contrast) did not run | Accepted as a partial pass. Full scan needs a browser: `npx impeccable detect http://localhost:3000` **could not run here** — no Chrome in the sandbox. Run it before submitting |
| Hallmark `sloplint --tier floor` | `src/app`, `docs/architecture.html` | 22 findings → fixed: colour literals outside tokens, 9px letter-spaced tags, arrow glued to a link label, missing `overflow-x: clip` | Down to **2 findings**, both deliberately skipped below |
| Hallmark `sloplint` | `globals.css`, `architecture.html` | "no Hallmark stamp on the first line of any CSS" | **Skipped on purpose.** The stamp marks a page as built with a Hallmark theme. This UI has no Hallmark theme: adopting the gate list is honest, adding the stamp would claim a design system I did not use |
| `ponytail` ladder | `src/lib/query.ts` | sort expression would have existed twice (ORDER BY + cursor) | One `SORT[key]` table now emits both, plus the parameter cast a row comparison needs |
| `ponytail` ladder | `src/lib/ingest/persist.ts` | benchmark scores passed a slug into an FK column | Resolve slug→id first; skip rows whose model was rejected upstream |
| `ponytail` ladder | `src/app/api/stats/route.ts` | `_sum` on a boolean column (Postgres has no boolean sum; fails at runtime) | `COUNT(*) FILTER (WHERE …)` raw read |
