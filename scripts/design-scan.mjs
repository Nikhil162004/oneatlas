/**
 * Element-level design checks without a browser.
 *
 *   npm run lint:screens                          # against http://localhost:3000
 *   SCAN_URL=https://oneatlas.vercel.app npm run lint:screens
 *
 * `impeccable detect src/app` can only see source text: the rules that matter most (contrast,
 * minimum text size, padding inside a bordered box) need a rendered page with its CSS applied, and
 * this sandbox has no Chrome. So: fetch each screen, inline the stylesheet it links, and hand the
 * directory to the same tool. Results are then comparable to what a browser check would report.
 *
 * Why the stylesheet is copied rather than left as a URL: the resolver looks for files relative to
 * the scanned directory, and the dev-mode link carries a ?v= query it cannot follow.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname } from 'node:path';

const run = promisify(execFile);
const BASE = process.env.SCAN_URL ?? 'http://localhost:3000';
const OUT = '.design-scan';

const PAGES = {
  home: '/',
  models: '/models',
  filtered: '/models?type=IMAGE&capabilities=tools',
  detail: '/models/anthropic/claude-fable-5.2',
  rankings: '/rankings',
  compare: '/compare?ids=anthropic/claude-fable-5.2,google/gemini-2.5-pro',
  labs: '/labs',
  lab: '/labs/mistralai',
  providers: '/providers',
  search: '/search?q=claude',
};

await mkdir(OUT, { recursive: true });
let cssSeen = new Set();

for (const [name, path] of Object.entries(PAGES)) {
  const res = await fetch(BASE + path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} returned ${res.status} — start the server (npm run dev) first`);
  let html = await res.text();

  for (const href of html.match(/\/_next\/static\/css\/[^"?]+\.css/g) ?? []) {
    if (cssSeen.has(href)) continue;
    cssSeen.add(href);
    const css = await fetch(BASE + href, { cache: 'no-store' }).then((r) => r.text());
    const file = `${OUT}${href.split('?')[0]}`;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, css);
  }
  // Drop the cache-busting query so the tool's relative resolution finds the file we just saved.
  html = html.replace(/(\/_next\/static\/css\/[^"]+?)\.css\?[^"]*"/g, '$1.css"');
  await writeFile(`${OUT}/${name}.html`, html);
}

console.log(`scanned ${Object.keys(PAGES).length} pages from ${BASE}, ${cssSeen.size} stylesheet(s)\n`);
try {
  // The HTML files by name, not the directory: pointed at a folder that also holds _next/, the
  // tool falls back to source-file mode and says so, which quietly turns the element rules off.
  const targets = Object.keys(PAGES).map((name) => `${OUT}/${name}.html`);
  const { stdout, stderr } = await run('npx', ['--yes', 'impeccable@latest', 'detect', ...targets], { maxBuffer: 1 << 26 });
  process.stdout.write(stdout);
  process.stderr.write(stderr);
} catch (err) {
  // A non-zero exit means findings, which is the tool's way of asking for a fix; the report is still
  // the interesting part, so print it and let the exit code carry the verdict.
  process.stdout.write(err.stdout ?? '');
  process.stderr.write(err.stderr ?? String(err.message));
  process.exitCode = 1;
}
