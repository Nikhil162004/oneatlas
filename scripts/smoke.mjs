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
  assert(/Every AI model, compared/.test(html), 'hero copy missing, is the page rendering at all?');
  assert(!/Application error|digest|MODULE_NOT_FOUND/.test(html), 'Next error overlay in the HTML');
  assert(/>\d{2,}<\/|476/.test(html.replace(/\s/g, '')) || !/—<\/dd>/.test(html), 'counters all em-dashes: server render cannot see the data layer');
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

console.log(`\n${pass} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
