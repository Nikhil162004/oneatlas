/**
 * Static guard: no `<Link>` may point at a route handler.
 *
 * `next/link` is not just an <a>: on click it does a client-side navigation and requests the RSC
 * flight payload for that URL (`?_rsc=…`). A route handler has no flight payload - `GET /api/models`
 * answers 200 with `application/json` and ignores the parameter - so the router gets a document it
 * cannot parse and the link appears to do nothing. That is what "Get the JSON" did on the home page.
 *
 * This cannot be caught from the served HTML, because a rendered <Link> and a rendered <a> are the
 * same markup, and it cannot be caught by fetching the endpoint, which answers 200 happily. So the
 * check is on source text. Deliberately narrow: only /api/* is a route handler here, every other href
 * is a page and should stay a <Link>.
 *
 *   node scripts/linkcheck.mjs          exit 1 and a file:line list on a violation
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.argv[2] ?? 'src';

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx|jsx)$/.test(name)) yield p;
  }
}

/* <Link … href="/api/x">, href={`/api/x`}, or href={'/api/x'} - the shapes that reach a handler.
   The href is read from a window after the match rather than from the match itself: the pattern below
   looks ahead at the quote instead of consuming it, so the match text stops before the path. */
/* "/api/" is a route handler; bare "/api" is the human-readable index page, and a <Link> to it is
   correct. The trailing slash is the whole difference, so the pattern has to be as specific as that. */
const VIOLATION = /<Link\b(?:[^<>]|\n)*?href\s*=\s*(?:"\/api\/|`\/api\/|\{\s*['"`]\/api\/)/g;
const HREF = /href\s*=\s*[{\s'"`]*(\/api[^'"`\s}]*)/;

const hits = [];
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(VIOLATION)) {
    const href = text.slice(m.index, m.index + 240).match(HREF)?.[1] ?? '(unparsed)';
    hits.push({ where: `${relative('.', file)}:${text.slice(0, m.index).split('\n').length}`, href });
  }
}

if (hits.length) {
  console.error(`linkcheck: ${hits.length} <Link> pointing at a route handler.`);
  for (const h of hits) console.error(`  ${h.where}  href="${h.href}"  ->  use a plain <a>`);
  console.error('\nWhy: next/link asks that URL for an RSC payload; a route handler returns JSON, so the click does nothing.');
  process.exit(1);
}
console.log(`linkcheck: no <Link> points at an API route in ${ROOT}/`);
