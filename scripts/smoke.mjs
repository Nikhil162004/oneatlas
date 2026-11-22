/**
 * Contract smoke test against a running server (dev, or the deployed URL).
 *   npm run smoke                                    # localhost:3000
   SMOKE_URL=https://oneatlas.vercel.app npm run smoke
 *
 * This is not a substitute for the unit tests: those pin the SQL builder's behaviour, this pins
 * what the deployed product promises a client. Deliberately checks the boring failure cases too,
 * because an API that 500s on a typo will be demoed on stage.
 */

const BASE = process.env.SMOKE_URL ?? 'http://localhost:3000';
let pass = 0;
const fail = [];

async function check(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    fail.push(`${name}: ${err.message}`);
    console.log(`  FAIL ${name}: ${err.message}`);
  }
}

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log(`smoke against ${BASE}`);

await check('GET / renders numbers, not an error page', async () => {
  // Added after a real outage: every /api/* check stayed green while / 500'd, because a page
  // failure and an API failure have different causes. Green API + broken HTML is the state a
  // reviewer sees first, so smoke has to look at the HTML.
  const res = await fetch(`${BASE}/`, { cache: 'no-store' });
  const html = await res.text();
  assert(res.status === 200, `HTTP ${res.status}`);
  assert(/who serves it and what each charges/.test(html), 'hero line missing, is the page rendering at all?');
  // The landing numbers are the claim the README makes, so they belong in a check and not in a slide.
  assert((html.match(/class="meter/g) ?? []).length >= 5, 'no coverage meters rendered');
  // A missing chunk or a thrown render error makes Next answer 500, so the status is the real
  // signal. Do NOT grep the HTML for "digest" and friends: that string is in every dev response
  // (React's dev payload) and the assertion would fail on a healthy page.
  const dashes = (html.match(/>\u2014<\/dd>/g) ?? []).length;
  assert(dashes < 4, `all four counters are em-dashes (dashes=${dashes}): the server render cannot see the data layer`);
});

await check('GET /api/stats reports the catalogue and cache headers', async () => {
  const { status, body, headers } = await get('/api/stats');
  assert(status === 200, `HTTP ${status}`);
  assert(body.data.models > 0, 'no models — has the ingest run?');
  assert(headers.get('cache-control')?.includes('s-maxage'), `cache-control: ${headers.get('cache-control')}`);
});

await check('GET /api/models paginates without repeating or dropping rows', async () => {
  const a = await get('/api/models?limit=5&sort=released');
  assert(a.status === 200 && a.body.data.length === 5, `page 1 gave ${a.body?.data?.length}`);
  assert(a.body.meta.nextCursor, 'page 1 offered no cursor');
  const b = await get(`/api/models?limit=5&sort=released&cursor=${a.body.meta.nextCursor}`);
  assert(b.status === 200, `page 2 HTTP ${b.status}`);
  const one = a.body.data.map((m) => m.id);
  const two = b.body.data.map((m) => m.id);
  assert(!one.some((id) => two.includes(id)), `page 2 repeats page 1: ${one.filter((id) => two.includes(id))}`);
  assert(a.body.meta.total > 5, `page 1 total should describe the filtered set, got ${a.body.meta.total}`);
  assert(b.body.meta.total === null, `page 2 must not report a total, got ${b.body.meta.total}`);
  const firstOfPage2 = b.body.data[0].releaseDate;
  const lastOfPage1 = a.body.data.at(-1).releaseDate;
  assert(firstOfPage2 <= lastOfPage1, `page 2 started at ${firstOfPage2}, after page 1 ended at ${lastOfPage1}`);
});

await check('sort=priceLow really orders by cheapest provider', async () => {
  const { body } = await get('/api/models?limit=8&sort=priceLow');
  const prices = body.data.map((m) => m.pricing.per1M.prompt ?? Number.MAX_SAFE_INTEGER);
  assert(prices.every((p, i) => i === 0 || prices[i - 1] <= p), `not ascending: ${prices}`);
});

await check('filters compose: type + capability + minContext + hideDeprecated', async () => {
  const q = '/api/models?limit=5&type=IMAGE&capabilities=tools,vision&minContext=100000&hideDeprecated=true';
  const { status, body } = await get(q);
  assert(status === 200, `HTTP ${status}`);
  for (const m of body.data) {
    assert(m.modelType === 'IMAGE', `type leaked: ${m.slug}`);
    assert(m.capabilities.tools && m.capabilities.visionInput, `capability leaked: ${m.slug}`);
    assert(m.contextWindow >= 100000, `context leaked: ${m.slug}`);
    assert(!m.deprecatedAt, `deprecated leaked: ${m.slug}`);
  }
});

await check('a typed LIKE wildcard is matched literally, not applied', async () => {
  // Unescaped, q=%%% would match every row. Escaped, it must match only names containing "%%%".
  const wildcard = await get('/api/models?q=%25%25%25');
  assert(wildcard.status === 200, `HTTP ${wildcard.status}`);
  assert(wildcard.body.meta.total === 0, `wildcard search matched ${wildcard.body.meta.total} rows, expected 0`);
  const letter = await get('/api/models?q=a');
  assert(letter.body.meta.total > 0, 'a plain letter query found nothing, which means search is broken');
});

await check('unknown slug is 404 and bad params are 400, both with the error envelope', async () => {
  const missing = await get('/api/models/nope/no-such-model');
  assert(missing.status === 404, `expected 404, got ${missing.status}`);
  assert(missing.body.error.code === 'not_found', 'no error code on 404');
  const bad = await get('/api/models?limit=99999&sort=drop');
  assert(bad.status === 400, `expected 400, got ${bad.status}`);
  assert(bad.body.error.fields, '400 without a field map');
});

await check('GET /api/models/{lab}/{slug} carries providers and benchmarks', async () => {
  const list = await get('/api/models?limit=1&capabilities=tools');
  const slug = list.body.data[0].slug;
  const { status, body } = await get(`/api/models/${slug}`);
  assert(status === 200, `HTTP ${status} for ${slug}`);
  assert(body.data.providers.length >= 1, 'no providers');
  assert(Array.isArray(body.data.benchmarks), 'benchmarks missing entirely');
});

await check('compare keeps the caller order and marks what it could not load', async () => {
  const list = await get('/api/models?limit=2');
  const ids = [...list.body.data.map((m) => m.slug), 'ghost/model-xyz'].join(',');
  const { status, body } = await get(`/api/models/compare?ids=${encodeURIComponent(ids)}`);
  assert(status === 200, `HTTP ${status}`);
  assert(body.data.rows.length === 2, `expected 2 loaded rows, got ${body.data.rows.length}`);
  assert(body.data.selected.find((s) => s.slug === 'ghost/model-xyz')?.found === false, 'missing id not marked');
});

await check('compare rejects one model and seven models', async () => {
  const one = await get('/api/models/compare?ids=a/b');
  assert(one.status === 400, `single id returned ${one.status}`);
  const many = await get('/api/models/compare?ids=' + Array.from({ length: 7 }, (_, i) => `l/m${i}`).join(','));
  assert(many.status === 400, `seven ids returned ${many.status}`);
});

await check('GET /api/rankings returns a leaderboard with ranks', async () => {
  const { status, body } = await get('/api/rankings?limit=5');
  assert(status === 200, `HTTP ${status}`);
  assert(body.data.length > 0, 'empty leaderboard — ingest wrote no scores?');
  assert(body.data[0].rank === 1, 'ranks do not start at 1');
  const scores = body.data.map((r) => r.score);
  assert(scores.every((s, i) => i === 0 || scores[i - 1] >= s), `not descending: ${scores}`);
});

await check('GET /api/search groups models, labs and providers', async () => {
  const { status, body } = await get('/api/search?q=gpt');
  assert(status === 200, `HTTP ${status}`);
  assert(['models', 'labs', 'providers'].every((k) => Array.isArray(body.data[k])), 'missing a group');
  const missing = await get('/api/search?q=zzzznothing');
  assert(missing.body.meta.empty === true, 'no-result search is not marked empty');
});

await check('GET /api/labs and /api/providers list the directory', async () => {
  const labs = await get('/api/labs?limit=5');
  assert(labs.status === 200 && labs.body.data.length > 0, 'labs empty');
  const first = labs.body.data[0];
  assert(first.modelCount > 0, `lab with no models sorted first: ${first.slug}`);
  const detail = await get(`/api/labs/${first.slug}`);
  assert(detail.status === 200 && detail.body.data.models.length === first.modelCount, 'lab detail disagrees with the directory');
});

/* ---- screens ------------------------------------------------------------------
 * Everything above is the API. These exist because the two halves of this app can fail
 * independently: a page can 500 with a healthy API (that already happened once — a server
 * component doing a relative fetch), and a page can render an em-dash where a number belongs,
 * which no status code would catch. So: assert on the numbers, and assert they agree with the API.
 */

const getPage = async (path) => {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  // React separates adjacent text nodes with comments, so `{n} matching` arrives as
  // `476<!-- --> matching`. Strip them or every "does the page show this number" assertion is a
  // coin flip on whether the expression happened to be one node or two.
  return { status: res.status, text: (await res.text()).replace(/<!--\s*-->/g, '') };
};

await check('GET /models lists rows and agrees with the API on the total', async () => {
  const page = await getPage('/models');
  assert(page.status === 200, `HTTP ${page.status}`);
  assert(/<table/.test(page.text), 'no table rendered');
  const api = await get('/api/models?limit=25');
  const shown = page.text.match(/href="\/models\/[a-z0-9.-]+\/[a-z0-9.-]+"/g) ?? [];
  assert(shown.length >= 20, `only ${shown.length} model links in the page body`);
  assert(page.text.includes(`${api.body.meta.total} matching`), `page does not state the API's total of ${api.body.meta.total}`);
});

await check('a filter changes the result count on the page, not just the API', async () => {
  const all = await get('/api/models?limit=1');
  const img = await get('/api/models?limit=1&type=IMAGE&capabilities=tools');
  assert(img.status === 200 && img.body.meta.total > 0 && img.body.meta.total < all.body.meta.total, `filter did not narrow: ${img.body.meta.total} of ${all.body.meta.total}`);
  const page = await getPage('/models?type=IMAGE&capabilities=tools');
  assert(page.text.includes(`${img.body.meta.total} matching`), 'page shows a different count than the same query on the API');
  // The capability chips must come back checked, or a filtered URL loses the filter when the user
  // tweaks anything else.
  // Attribute order is React's business, not ours, so find the tag first and then look inside it.
  const chip = page.text.match(/<input[^>]*value="tools"[^>]*>/)?.[0] ?? '';
  assert(/checked/.test(chip), `tools chip not rendered checked, so the form loses the filter: ${chip}`);
});

await check('GET /models/{lab}/{slug} renders the provider table; unknown is 404', async () => {
  const list = await get('/api/models?limit=1&sort=priceLow');
  const slug = list.body.data[0].slug;
  const detail = await get(`/api/models/${slug}`);
  const page = await getPage(`/models/${slug}`);
  assert(page.status === 200, `HTTP ${page.status} for ${slug}`);
  assert(page.text.includes(detail.body.data.name), 'model name missing from the page');
  const endpointProviders = detail.body.data.providers.filter((x) => x.fromEndpoint).length;
  assert(typeof detail.body.data.providers[0].fromEndpoint === 'boolean', 'a listing does not say where it came from');
  assert(page.text.includes(`${endpointProviders}`), `endpoint count ${endpointProviders} not rendered`);
  assert(/cheapest/.test(page.text), 'no cheapest marker on the price list');
  // The live product deep-links #providers; the anchor is a contract with anyone pasting a link.
  assert(/id="providers"/.test(page.text), 'detail page lost its #providers anchor');
  const missing = await getPage('/models/ghost/no-such-model');
  assert(missing.status === 404, `unknown model page returned ${missing.status}, expected 404`);
});

await check('GET /rankings and /compare render the data behind them', async () => {
  const rk = await getPage('/rankings');
  const api = await get('/api/rankings?limit=50');
  assert(rk.status === 200 && rk.text.includes(`${api.body.meta.total} scored rows`), `rankings page disagrees with the API (${api.body.meta.total} rows)`);

  const ids = (await get('/api/models?limit=2')).body.data.map((m) => m.slug);
  const cmp = await getPage(`/compare?ids=${encodeURIComponent(ids.join(','))}`);
  assert(cmp.status === 200, `HTTP ${cmp.status}`);
  for (const slug of ids) {
    const name = (await get(`/api/models/${slug}`)).body.data.name;
    assert(cmp.text.includes(name), `${name} missing from the comparison`);
  }
  const single = await getPage('/compare?ids=' + ids[0]);
  assert(single.status === 200 && /Pick at least two/.test(single.text), 'a one-model compare should show the picker, not an error');
});

await check('GET /labs, /providers and a lab page render the directory', async () => {
  const labs = await get('/api/labs?limit=200');
  const page = await getPage('/labs');
  assert(page.status === 200 && page.text.includes(`${labs.body.data.length} organisations`), 'lab count on page disagrees with API');
  const prov = await getPage('/providers');
  assert(prov.status === 200 && /<tbody/.test(prov.text), 'providers table missing');
  const firstLab = labs.body.data[0];
  const lab = await getPage(`/labs/${firstLab.slug}`);
  assert(lab.status === 200, `lab page HTTP ${lab.status}`);
  // Count the rows rather than a label: the directory's number and the page's table have to agree,
  // and "6 models" appears on the directory page, not this one.
  const labRows = (lab.text.match(/href="\/models\/[a-z0-9.-]+\//g) ?? []).length;
  assert(labRows === firstLab.modelCount, `${firstLab.slug}: profile lists ${labRows} models, directory says ${firstLab.modelCount}`);
  assert((await getPage('/labs/ghost')).status === 404, 'unknown lab should be a 404 page');
});

await check('GET /api/providers/{slug} and its page list the same supported models', async () => {
  const dir = await get('/api/providers?limit=5');
  const first = dir.body.data[0];
  const detail = await get(`/api/providers/${first.slug}`);
  assert(detail.status === 200, `HTTP ${detail.status}`);
  assert(detail.body.data.models.length === detail.body.data.modelCount, 'profile models disagree with its own count');
  assert(detail.body.data.models.every((m) => m.slug && m.per1M), 'a supported model lacks a slug or price');
  const page = await getPage(`/providers/${first.slug}`);
  assert(page.status === 200 && page.text.includes(first.name), 'provider page did not render its name');
  assert(page.text.includes(`${detail.body.data.modelCount}`), 'provider page count disagrees with the API');
  assert((await get(`/api/providers/ghost-provider`)).status === 404, 'unknown provider should be a 404');
  assert((await getPage('/providers/ghost-provider')).status === 404, 'unknown provider page should be a 404 page');
});

await check('GET /api/rankings?view=value ranks by score per dollar, and alternatives stay on-type', async () => {
  const { status, body } = await get('/api/rankings?view=value&limit=10');
  assert(status === 200, `HTTP ${status}`);
  assert(body.data.length >= 5, 'value board is nearly empty');
  assert(body.data.every((r) => r.cheapestPromptPer1M > 0 && r.value !== null), 'an unpriced row was valued');
  for (let i = 1; i < body.data.length; i++) {
    assert(body.data[i - 1].value >= body.data[i].value, 'value board is not ordered by score per dollar');
  }
  const one = await get('/api/models?limit=1');
  const slug = one.body.data[0].slug;
  const alt = await get(`/api/models/${slug}/alternatives`);
  assert(alt.status === 200 && alt.body.data.length > 0, 'no alternatives returned');
  assert(alt.body.data.every((a) => a.slug !== slug), 'a model is its own alternative');
  assert(alt.body.data.every((a) => a.modelType === one.body.data[0].modelType), 'an alternative is a different type');
  const page = await getPage('/rankings?view=value');
  assert(page.text.includes('Best value'), 'the rankings page does not offer the value board');
});

await check('changes feed and ingest status report what the mirrors did', async () => {
  const changes = await get('/api/changes?limit=5');
  assert(changes.status === 200 && Array.isArray(changes.body.data), 'changes feed is not an array envelope');
  assert(typeof changes.body.meta.total === 'number', 'changes feed has no total');
  const status = await get('/api/status');
  assert(status.status === 200 && Array.isArray(status.body.data.runs), 'status has no runs array');
  assert(status.body.data.counts.models > 0, 'status counts no models');
  assert(status.body.data.runs.length > 0 && status.body.data.lastSuccessAt, 'no successful ingest run recorded');
  assert(status.body.data.runs[0].startedAt >= (status.body.data.runs.at(-1)?.startedAt ?? ''), 'runs are not newest first');
  const changesPage = await getPage('/changes');
  assert(changesPage.status === 200 && changesPage.text.includes('Changes'), 'changes page did not render');
  const statusPage = await getPage('/status');
  assert(statusPage.status === 200 && statusPage.text.includes('Recent ingest runs'), 'status page did not render its runs');
});

await check('model history, biggest movers and the RSS feed tell the same story', async () => {
  const rss = await getPage('/changes.xml');
  assert(rss.status === 200 && rss.text.includes('<rss') && rss.text.includes('OneAtlas changes'), 'RSS feed did not render');
  const feed = await get('/api/changes?limit=25');
  assert(feed.body.data.every((c) => 'pctChange' in c), 'feed rows carry no pctChange');
  const priced = feed.body.data.filter((c) => c.pctChange !== null);
  if (priced.length) {
    const page = await getPage('/changes');
    assert(page.text.includes('Biggest movers'), 'movers section missing while priced changes exist');
  }
  if (feed.body.data.length) {
    const slug = feed.body.data[0].modelSlug;
    const page = await getPage(`/models/${slug}`);
    assert(page.status === 200 && page.text.includes('History'), 'model page has no history section');
    assert(page.text.includes(feed.body.data[0].field), 'history omits the newest recorded field');
    const rssHas = rss.text.includes(slug);
    assert(rssHas, 'RSS omits the newest changed model');
  }
});

await check('the OpenAPI document describes routes that answer, and the badge renders', async () => {
  const spec = await get('/api/openapi.json');
  assert(spec.status === 200 && String(spec.body.openapi).startsWith('3'), 'no OpenAPI 3 document');
  for (const p of ['/models', '/models/{lab}/{slug}', '/models/compare', '/rankings', '/changes', '/status']) {
    assert(spec.body.paths[p], `spec omits ${p}`);
  }
  const two = await get('/api/models?limit=2');
  const slug = two.body.data[0].slug;
  // Every documented path must answer; the two with required parameters get valid samples.
  const samples = {
    '/models/compare': `/models/compare?ids=${two.body.data.map((m) => m.slug).join(',')}`,
    '/search': '/search?q=claude',
  };
  for (const tpl of Object.keys(spec.body.paths)) {
    if (tpl.includes('{')) continue;
    const res = await get('/api' + (samples[tpl] ?? tpl));
    assert(res.status === 200, `documented path ${tpl} answered ${res.status}`);
  }
  const badge = await getPage(`/api/models/${slug}/badge.svg`);
  assert(badge.status === 200 && badge.text.includes('<svg'), 'badge is not an SVG');
  assert(badge.text.includes(two.body.data[0].name), 'badge does not name the model');
  assert((await getPage(`/api/models/ghost-lab/ghost-model/badge.svg`)).status === 404, 'ghost badge should be a 404');
});

await check('benchmark profiles, the calculator seed and the sitemap come from the mirror', async () => {
  const list = await get('/api/benchmarks');
  assert(list.status === 200 && list.body.data.length > 0, 'no benchmarks listed');
  const first = list.body.data.find((b) => b.scoredModels > 0) ?? list.body.data[0];
  assert(first.top === null || typeof first.top.score === 'number', 'top score is not numeric');
  const detail = await get(`/api/benchmarks/${first.slug}`);
  assert(detail.status === 200 && Array.isArray(detail.body.data.scores), 'benchmark profile has no scores');
  if (detail.body.data.scores.length > 1) {
    const scores = detail.body.data.scores.map((s) => s.score);
    const sorted = [...scores].sort((a, b) => (detail.body.data.higherIsBetter ? b - a : a - b));
    assert(JSON.stringify(scores) === JSON.stringify(sorted), 'scores ignore the benchmark direction');
  }
  assert((await get('/api/benchmarks/ghost-benchmark')).status === 404, 'ghost benchmark should be a 404');
  const page = await getPage(`/benchmarks/${first.slug}`);
  assert(page.status === 200 && page.text.includes(first.name), 'benchmark page did not render its name');
  const calc = await getPage('/calculator');
  assert(calc.status === 200 && calc.text.includes('Cost calculator'), 'calculator did not render');
  const sitemap = await getPage('/sitemap.xml');
  assert(sitemap.status === 200 && sitemap.text.includes('/models/') && sitemap.text.includes('/benchmarks/'), 'sitemap lacks mirrored URLs');
  const robots = await getPage('/robots.txt');
  assert(robots.status === 200 && robots.text.includes('sitemap.xml'), 'robots does not point at the sitemap');
  const home = await getPage('/');
  assert(home.text.includes('og:title'), 'no Open Graph title on the home page');
});

await check('the theme script ships and both schemes are declared in CSS', async () => {
  const home = await getPage('/');
  assert(home.text.includes('oneatlas:theme'), 'no theme init script in the document head');
  assert(home.text.includes('Switch to'), 'no theme toggle in the header');
  const css = await (await fetch(`${BASE}/_next/static/css/`)).text().catch(() => '');
  const cssHref = home.text.match(/\/_next\/static\/css\/[^"?]+\.css/)?.[0];
  assert(cssHref, 'no stylesheet linked');
  const sheet = await (await fetch(`${BASE}${cssHref}`)).text();
  assert(sheet.includes("data-theme='light'") || sheet.includes('data-theme=\"light\"') || sheet.includes('[data-theme=light]') || sheet.includes('data-theme'), 'stylesheet declares no light scheme');
  assert(sheet.includes('#94a7d9'), 'dark accent missing from the stylesheet');
  assert(sheet.includes('#4763ac'), 'light accent missing from the stylesheet');
});

await check('the watchlist API resolves slugs to live rows and names the missing', async () => {
  const two = await get('/api/models?limit=2');
  const ids = two.body.data.map((m) => m.slug).join(',');
  const res = await get(`/api/models/watchlist?ids=${ids},ghost-lab/ghost-model`);
  assert(res.status === 200 && res.body.data.length === 2, 'watchlist rows missing');
  assert(res.body.data.every((r) => 'cheapest' in r && 'latestChange' in r), 'rows lack price or change fields');
  assert(res.body.meta.missing.includes('ghost-lab/ghost-model'), 'ghost slug not reported missing');
  const page = await getPage('/watchlist');
  assert(page.status === 200 && page.text.includes('Watchlist'), 'watchlist page did not render');
  const empty = await get('/api/models/watchlist');
  assert(empty.status === 200 && empty.body.data.length === 0, 'empty watchlist should be an empty array, not an error');
});

await check('collections rank by their printed criteria and the finder maps to filters', async () => {
  const list = await get('/api/collections');
  assert(list.status === 200 && list.body.data.length === 5, 'expected five collections');
  const longest = await get('/api/collections/longest-context');
  assert(longest.status === 200 && longest.body.data.rows.length > 0, 'longest-context is empty');
  const ctx = longest.body.data.rows.map((r) => r.contextWindow);
  assert(JSON.stringify(ctx) === JSON.stringify([...ctx].sort((a, b) => b - a)), 'longest-context is not ordered by context');
  const free = await get('/api/collections/best-free');
  assert(free.body.data.rows.every((r) => r.prompt === 0), 'a priced model appears in best-free');
  const vision = await get('/api/collections/cheapest-vision');
  assert(vision.body.data.rows.every((r) => r.capabilities.visionInput), 'a blind model appears in cheapest-vision');
  const prices = vision.body.data.rows.map((r) => r.prompt ?? Infinity);
  assert(JSON.stringify(prices) === JSON.stringify([...prices].sort((a, b) => a - b)), 'cheapest-vision is not ordered by price');
  assert((await get('/api/collections/ghost-set')).status === 404, 'ghost collection should be a 404');
  const page = await getPage('/collections/longest-context');
  assert(page.status === 200 && page.text.includes('Longest context'), 'collection page did not render');
  const finder = await getPage('/finder');
  assert(finder.status === 200 && finder.text.includes('Model finder'), 'finder did not render');
});

await check('snippets, share cards and structured data describe the same record', async () => {
  const one = await get('/api/models?limit=1');
  const slug = one.body.data[0].slug;
  const page = await getPage(`/models/${slug}`);
  assert(page.status === 200, 'model page failed');
  assert(page.text.includes('application/ld+json'), 'no JSON-LD on the model page');
  assert(page.text.includes('og:image'), 'no og:image wired for the model page');
  assert(page.text.includes('Python') && page.text.includes('JavaScript'), 'snippet tabs missing');
  const img = await fetch(`${BASE}/models/${slug}/opengraph-image`);
  assert(img.status === 200, `share card answered ${img.status}`);
  assert((img.headers.get('content-type') ?? '').includes('image/png'), 'share card is not a PNG');
  const siteCard = await fetch(`${BASE}/opengraph-image`);
  assert(siteCard.status === 200, 'site share card missing');
  const lab = await getPage(`/labs/${one.body.data[0].lab.slug}`);
  assert(lab.text.includes('application/ld+json'), 'no JSON-LD on the lab page');
});

await check('the home page leads with search and shows what is moving', async () => {
  const home = await getPage('/');
  assert(home.status === 200, 'home failed');
  assert(home.text.includes('id="hero-search"'), 'no hero search field');
  assert(home.text.includes('Biggest price moves'), 'no movers section on the home page');
  assert(home.text.includes('Newest releases'), 'no newest releases on the home page');
  assert(home.text.includes('For developers'), 'footer columns missing');
  const labs = await getPage('/labs');
  assert(labs.text.includes('labmark'), 'labs carry no monograms');
  const rankings = await getPage('/rankings');
  assert(rankings.text.includes('podium-num'), 'rankings carry no podium');
});

await check('the benchmark matrix flags true column bests and releases group by month', async () => {
  const matrix = await get('/api/benchmarks/matrix');
  assert(matrix.status === 200 && matrix.body.data.rows.length > 0, 'matrix is empty');
  const b0 = matrix.body.data.benchmarks[0];
  const col = matrix.body.data.rows.map((r) => r.cells[0]).filter((c) => c !== null);
  const trueBest = b0.higherIsBetter ? Math.max(...col.map((c) => c.score)) : Math.min(...col.map((c) => c.score));
  assert(col.filter((c) => c.best).every((c) => c.score === trueBest), 'a flagged best is not the column extreme');
  assert(col.some((c) => c.best), 'no best flagged in the first column');
  const page = await getPage('/benchmarks/matrix');
  assert(page.status === 200 && page.text.includes('Benchmark matrix'), 'matrix page did not render');
  const rel = await get('/api/releases');
  assert(rel.status === 200 && rel.body.data.length > 0, 'releases are empty');
  const months = rel.body.data.map((m) => m.month);
  assert(JSON.stringify(months) === JSON.stringify([...months].sort().reverse()), 'release months are not descending');
  assert(rel.body.meta.dated > 0 && rel.body.meta.months === rel.body.data.length, 'release meta disagrees with the groups');
  const relPage = await getPage('/releases');
  assert(relPage.status === 200 && relPage.text.includes('Releases'), 'releases page did not render');
  const api = await getPage('/api');
  assert(api.text.includes('Try it'), 'playground missing from the API page');
});

await check('per-model RSS, the shortcuts hint and the print stylesheet ship', async () => {
  const one = await get('/api/models?limit=1');
  const slug = one.body.data[0].slug;
  const feed = await getPage(`/models/${slug}/feed.xml`);
  assert(feed.status === 200 && feed.text.includes('<rss') && feed.text.includes('changes'), 'per-model feed did not render');
  assert((await getPage('/models/ghost-lab/ghost-model/feed.xml')).status === 404, 'ghost model feed should be a 404');
  const home = await getPage('/');
  assert(home.text.includes('keyboard shortcuts'), 'no shortcuts hint in the footer');
  const cssHref = home.text.match(/\/_next\/static\/css\/[^"?]+\.css/)?.[0];
  const sheet = await (await fetch(`${BASE}${cssHref}`)).text();
  assert(sheet.includes('@media print'), 'no print stylesheet in the served CSS');
  const modelPage = await getPage(`/models/${slug}`);
  assert(modelPage.text.includes('follow via RSS'), 'model page does not link its feed');
});

await check('footer documents render for humans, not just tools', async () => {
  const home = await getPage('/');
  for (const href of ['href="/openapi"', 'href="/status/json"', 'href="/sitemap"', 'href="/changes#rss"']) {
    assert(home.text.includes(href), `footer does not link ${href}`);
  }
  const oa = await getPage('/openapi');
  assert(oa.status === 200 && oa.text.includes('/models/{lab}/{slug}') && oa.text.includes('Endpoints'), 'spec viewer did not render the documentation');
  const sj = await getPage('/status/json');
  assert(sj.status === 200 && sj.text.includes('&quot;counts&quot;') && sj.text.includes('Models mirrored'), 'status viewer did not render stats and envelope');
  const smPage = await getPage('/sitemap');
  assert(smPage.status === 200 && smPage.text.includes('href="/models/') && smPage.text.includes('Models by lab'), 'sitemap page did not render the inventory');
  const changes = await getPage('/changes');
  assert(changes.text.includes('id="rss"') && changes.text.includes('/changes.xml'), 'no RSS section on the changes page');
  const sm = await getPage('/sitemap.xml');
  assert(sm.text.includes('<?xml-stylesheet') && sm.text.includes('/sitemap.xsl'), 'sitemap carries no browser stylesheet');
  const sx = await getPage('/sitemap.xsl');
  assert(sx.status === 200 && sx.text.includes('xsl:stylesheet'), 'sitemap stylesheet missing');
  const rss = await getPage('/changes.xml');
  assert(rss.text.includes('/feed.xsl'), 'change feed carries no browser stylesheet');
  const fx = await getPage('/feed.xsl');
  assert(fx.status === 200 && fx.text.includes('xsl:stylesheet'), 'feed stylesheet missing');
});

await check('a catalogue price is not counted as a provider offer', async () => {
  // The 476 models ingested without --endpoints each carry one listing derived from their own
  // catalogue entry. Counting those as "providers" put a row called "Unknown provider" at the top of
  // the directory, and averaging over their null uptimes reported 0.00% availability.
  const { body } = await get('/api/providers');
  assert(body.data.length > 0, 'the directory is empty');
  assert(!body.data.some((p) => /unknown provider/i.test(p.name)), 'the catalogue placeholder is listed as a provider');
  assert(body.meta.catalogueOnlyListings > 0, 'nothing was excluded, which means ingest has not run both passes');
  assert(body.data.every((p) => p.listingCount > 0), 'a provider with no endpoint listings is listed');
  const zero = body.data.filter((p) => p.avgUptimePct === 0 || p.avgLatencyMs === 0);
  assert(zero.length === 0, `an average of exactly 0 means nulls were read as measurements: ${zero.map((p) => p.name)}`);
  const stats = await get('/api/stats');
  assert(stats.body.data.providers === body.data.length, `stats says ${stats.body.data.providers} providers, the directory lists ${body.data.length}`);
});

await check('every stacked table cell carries a label, so a phone shows no orphan values', async () => {
  // Under 860px a `.stack-sm` table renders one card per row with `data-label` as the line label.
  // A cell without one is invisible breakage: the value is there, its meaning is not. Nothing but
  // the markup can catch that, so the markup is what this checks.
  for (const path of ['/models', '/providers', '/rankings', '/labs/mistralai']) {
    const page = await getPage(path);
    assert(page.status === 200, `${path} HTTP ${page.status}`);
    const body = page.text.match(/<table class="stack-sm[\s\S]*?<\/tbody>/)?.[0] ?? '';
    assert(body, `${path}: no stack-sm tbody found, the table pattern regressed`);
    const cells = body.match(/<td[^>]*>/g) ?? [];
    const labelled = cells.filter((c) => /data-label=|data-title/.test(c));
    assert(cells.length > 0, `${path}: empty tbody`);
    assert(labelled.length === cells.length, `${path}: ${cells.length - labelled.length} of ${cells.length} cells have no data-label`);
  }
});

await check('a chip on the filter bar removes one parameter and keeps the rest', async () => {
  // This is the whole promise of the URL-as-state design, so it is worth an assertion: the × has to
  // be a link that deletes exactly one key. A clear-one link that also drops the search, or that
  // drops nothing, is a bug a screenshot would never show.
  const page = await getPage('/models?q=mistral&capabilities=tools,vision&sort=priceLow');
  assert(page.status === 200, `HTTP ${page.status}`);
  // Only the document body: the RSC payload at the end of the response repeats this markup as
  // escaped strings, which would double every count below.
  const body = page.text.match(/<main id="main">[\s\S]*?<\/main>/)?.[0] ?? page.text;
  const chips = [...body.matchAll(/<a class="chip-x" href="([^"]*)"[\s\S]*?<\/a>/g)].map((m) => m[1]);
  assert(chips.length === 3, `expected three chips (search, tools, vision), got ${chips.length}`);
  const tools = chips.find((h) => h.includes('capabilities=vision'));
  assert(tools, `no chip removes only the tools capability: ${chips.join(' ')}`);
  assert(tools.includes('q=mistral'), 'clearing a capability also cleared the search');
  assert(tools.includes('sort=priceLow'), 'clearing a capability also cleared the sort');
  assert(!/capabilities=tools/.test(tools) && /capabilities=vision/.test(tools), `tools chip kept or lost the wrong value: ${tools}`);
  // Exactly one target drops q, and it must carry everything else over unchanged (a comma list
  // survives as one value, which is what the schema accepted in the first place).
  const noQ = chips.filter((h) => !/[?&]q=/.test(h));
  assert(noQ.length === 1, `expected one chip that removes the search, got ${noQ.length}`);
  assert(/capabilities=tools(%2C|,)vision/.test(noQ[0]), `removing the search lost the capabilities: ${noQ[0]}`);
  assert(noQ[0].includes('sort=priceLow'), 'removing the search lost the sort');
  assert(body.includes('Clear all'), 'no way back to the unfiltered list');
});

await check('a linked row exposes exactly one tab stop', async () => {
  // The row's click target is a stretched ::after on the name link; the link itself has to stay
  // unique per row, or the keyboard gets four identical stops per row.
  const page = await getPage('/models?limit=12');
  const rows = page.text.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const withLink = rows.filter((r) => /class="rowlink/.test(r));
  assert(withLink.length >= 10, `only ${withLink.length} of ${rows.length} rows are clickable`);
  for (const r of withLink) {
    const n = (r.match(/class="rowlink/g) ?? []).length;
    assert(n === 1, `a row has ${n} stretched links, one is the maximum`);
  }
});

await check('the provider filter works by slug and by name, and is reachable from the form', async () => {
  // Requirement: "Filter by company, provider, capabilities and model type". The provider filter used
  // to live only in the API and only accepted a slug, so `?provider=OpenAI` answered "0 matching" —
  // a wrong answer shaped like a real one.
  const bySlug = await get('/api/models?provider=openai&limit=1');
  const byName = await get('/api/models?provider=OpenAI%20Corporation&limit=1');
  const byPlainName = await get('/api/models?provider=OpenAI&limit=1');
  assert(bySlug.body.meta.total > 0, 'the openai slug matches nothing, is the mirror loaded?');
  assert(byPlainName.body.meta.total === bySlug.body.meta.total, `by name ${byPlainName.body.meta.total} != by slug ${bySlug.body.meta.total}`);
  assert(byName.body.meta.total === 0, 'a name that does not exist matched rows anyway');
  const api = await get('/api/models?provider=openai&limit=1');
  const page = await getPage('/models?provider=openai');
  assert(page.text.includes(`${api.body.meta.total} matching`), 'the page count disagrees with the API for the same provider filter');
  assert(/name="provider"/.test(page.text), 'the filter form has no provider field');
  assert(/id="providers"/.test(page.text), 'the provider field has no datalist, so a person must guess slugs');
  const labByName = await getPage('/models?lab=Anthropic');
  assert(labByName.status === 200 && /matching/.test(labByName.text), 'lab filtering by name broke');
  // The directory has to lead somewhere: "discover providers and their supported models" is only
  // half a feature if a provider row is a dead end.
  const providers = await get('/api/providers?limit=200');
  assert(providers.body.data.length > 0 && providers.body.data.every((p) => p.slug), 'provider rows have no slug to link with');
  const dir = await getPage('/providers');
  const back = [...dir.text.matchAll(/href="\/models\?provider=([a-z0-9.-]+)"/g)].map((m) => m[1]);
  assert(back.length >= 10, `the directory links back to only ${back.length} providers`);
  assert(providers.body.data.some((p) => p.slug === back[0]), `the directory links to ${back[0]}, which is not a provider slug`);
  const jumped = await getPage(`/models?provider=${back[0]}`);
  assert(jumped.status === 200 && /matching/.test(jumped.text), 'following a directory link does not reach a filtered model list');
});

await check('the rankings board filters by model category and benchmark family', async () => {
  // Requirement: "Filter by model categories and benchmarks". Benchmark chips existed; the categories
  // were API-only, which is the same defect as a nav link to a page nobody built.
  const all = await get('/api/rankings?limit=1');
  const image = await get('/api/rankings?limit=1&type=IMAGE');
  assert(all.body.meta.total > 0, 'no scored rows at all, is ingest finished?');
  const page = await getPage('/rankings');
  assert(/name="type"/.test(page.text), 'the board has no model-category control');
  assert(/name="category"/.test(page.text), 'the board has no benchmark-family control');
  // Apply must not lose the benchmark a chip selected: the form carries it as a hidden field.
  const oneBench = await getPage('/rankings?benchmark=aa_engineering');
  assert(/<input type="hidden" name="benchmark" value="aa_engineering"/.test(oneBench.text), 'the category form drops the selected benchmark');
  const filtered = await getPage('/rankings?category=reasoning');
  const apiF = await get('/api/rankings?category=reasoning&limit=1');
  assert(filtered.status === 200, `HTTP ${filtered.status}`);
  assert(filtered.text.includes(`${apiF.body.meta.total} scored rows`), `page says something else than the API's ${apiF.body.meta.total} for category=reasoning`);
  assert(image.body.meta.total === 0 || image.body.data[0].model.modelType === 'IMAGE', 'a type filter let a non-image row through');
  const hidden = (await getPage('/rankings?category=reasoning&type=IMAGE')).status;
  assert(hidden === 200, 'an empty combination should render the empty state, not crash');
});

await check('every link to an API route resolves as a document, from every screen', async () => {
  // The complaint was "Get the JSON does nothing". The cause was a <Link> soft-navigating to a route
  // handler; the fix has two halves, and this checks the second one - that the href each screen
  // advertises really answers, with the media type that half promises, through the same path a
  // browser takes. A link to a 404 or to an HTML error page is caught here, not on someone's laptop.
  const seen = new Set();
  for (const path of ['/', '/models', '/providers', '/rankings', '/labs', '/models/anthropic/claude-fable-5.2']) {
    const page = await getPage(path);
    const hrefs = [...page.text.matchAll(/href="(\/api(?:\/[a-z0-9/._{}-]*)?)"/gi)].map((m) => m[1]);
    for (const href of new Set(hrefs)) {
      const res = await fetch(`${BASE}${href}`, { cache: 'no-store' });
      const type = res.headers.get('content-type') ?? '';
      assert(res.status === 200, `${path} links to ${href}, which answered ${res.status}`);
      // /api is the index page (HTML, and the thing a click should land on); /api/anything is a route
      // handler and must answer JSON. Two different promises, so two different assertions.
      const want = href === '/api' ? 'text/html' : 'application/json';
      assert(type.includes(want), `${path} links to ${href}, which answered ${type}, not ${want}`);
      await res.body?.cancel();
      seen.add(href);
    }
  }
  assert(seen.has('/api'), 'no screen links to the API index page');
  // The screens link to the index, and the index is where the raw documents are advertised - that is
  // the whole point of the index existing. So the count assertion belongs to /api, not to the app.
  const idx = await getPage('/api');
  const docs = new Set([...idx.text.matchAll(/href="(\/api\/[a-z0-9/._-]+)"/gi)].map((m) => m[1]));
  assert(docs.size >= 7, `the API index advertises only ${docs.size} raw documents`);
});

await check('the index row for POST /api/admin/ingest matches the route it describes', async () => {
  // This one exists because the check before it cannot catch prose being wrong about a handler:
  // the index advertised `x-ingest-token` and a body of { limit?, endpoints?, dryRun? } for a route
  // that read `x-internal-token` and parsed no body at all. So compare the page against the source.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/app/api/admin/ingest/route.ts', 'utf8');
  const header = src.match(/headers\.get\('([^']+)'\)/)?.[1];
  assert(header, 'the ingest route reads no auth header, so /api should not claim one');
  assert(!/request\.(json|text|arrayBuffer)\(\)/.test(src),
    'the ingest route now parses a body: document it on /api');
  const page = (await getPage('/api')).text.replace(/<!-- -->/g, '');
  assert(page.includes(header), `/api does not name the header the route reads (${header})`);
  assert(!/\{ limit\?/.test(page), '/api still advertises ingest body params the route ignores');
});

await check('the API index documents every route handler, and its printed bodies are real', async () => {
  // Hand-written prose about generated code is how documentation goes stale, so the two ways this
  // page could lie are both checked: a route handler existing without being documented, and sample
  // bodies being invented rather than executed.
  const { readdirSync, statSync } = await import('node:fs');
  const walk = (dir, acc = []) => {
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (statSync(p).isDirectory()) walk(p, acc);
      else if (name === 'route.ts') acc.push(p);
    }
    return acc;
  };
  const handlers = walk('src/app/api').map((p) =>
    p.replace('src/app', '').replace('/route.ts', '').replace(/\[([^\]]+)\]/g, '{$1}'));
  assert(handlers.length >= 10, `found only ${handlers.length} route handlers on disk`);

  const page = await getPage('/api');
  assert(page.status === 200, `the API index answered ${page.status}`);
  const missing = handlers.filter((h) => !page.text.includes(h));
  assert(!missing.length, `undocumented route handlers: ${missing.join(', ')}`);

  // Inside <pre> React renders a quote as &quot;, so compare on unescaped text: a check that only
  // passes on escaped markup would silently never match anything real.
  const text = page.text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
  const api = await get('/api/models?limit=2&sort=priceLow');
  assert(text.includes(`"total": ${api.body.meta.total}`), `the sample does not show the live total of ${api.body.meta.total}`);

  const rejected = await get('/api/models?limit=9999&type=NOT_A_TYPE');
  assert(rejected.status === 400, `the API stopped rejecting bad params (${rejected.status})`);
  const { code, message } = rejected.body.error;
  assert(text.includes(`"code": "${code}"`), `the index does not show the live error code "${code}"`);
  assert(text.includes(`"message": "${message}"`), `the index does not show the live message "${message}"`);
  for (const field of Object.keys(rejected.body.error.fields)) {
    assert(text.includes(`"${field}":`), `the index omits the "${field}" field the API reports`);
  }
});

await check('a model page shows the same JSON its endpoint returns', async () => {
  // The block on the detail page claims to be "this record as JSON". That is only worth saying if it
  // is comparable to the response body, so compare the parsed objects, not the strings.
  const first = await get('/api/models?limit=1&sort=released');
  const slug = first.body.data[0].slug;
  const [api, page] = await Promise.all([get(`/api/models/${slug}`), getPage(`/models/${slug}`)]);
  const pre = page.text.match(/<pre class="code[^"]*">([\s\S]*?)<\/pre>/)?.[1];
  assert(pre, 'the model page renders no JSON block');
  const unesc = pre.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const shown = JSON.parse(unesc);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  assert(eq([...Object.keys(shown)].sort(), [...Object.keys(api.body.data)].sort()), 'the page and the endpoint expose different fields');
  assert(eq(shown.slug, api.body.data.slug), 'the block is about a different model than its own label says');
  assert(eq(shown.providers.length, api.body.data.providers.length), 'provider listing count differs between page and endpoint');
  assert(eq(shown, api.body.data), 'the inline record and the endpoint response are not the same object');
  // The block's label names the endpoint it mirrors. That path has to answer, or the page is
  // advertising an API that does not exist — the class of bug that made this screen twice.
  const flat = page.text.replace(/<!-- -->/g, '');
  const advertised = flat.match(/GET (\/api\/models\/[a-z0-9/._-]+)/)?.[1];
  assert(advertised === `/api/models/${slug}`, `the page advertises "${advertised}" for ${slug}`);
  const doc = await get(advertised);
  const ctype = doc.headers.get('content-type') ?? '';
  assert(doc.status === 200 && ctype.includes('application/json'),
    `${advertised} answers ${doc.status}/${ctype}, not a readable document`);
});

console.log(`\n${pass} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
