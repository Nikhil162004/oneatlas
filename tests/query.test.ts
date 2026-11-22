import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildList, buildRanking, decodeCursor, encodeCursor, likeTerm, sortOf } from '../src/lib/query';
import { listQuerySchema } from '../src/lib/validation';

const q = (o: Record<string, unknown> = {}) => listQuerySchema.parse(o);

test('every placeholder is used exactly once and values line up with it', () => {
  const { text, values } = buildList(q({ q: "50% off", lab: 'anthropic', provider: 'groq', type: 'TEXT', capabilities: 'tools,reasoning', minContext: 100000, maxPrice: 5, free: true, hideDeprecated: true, sort: 'priceLow', limit: 10 }));
  const found = [...text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
  assert.deepEqual(found, Array.from({ length: values.length }, (_, i) => i + 1), 'placeholders must be 1..n with no gaps or reuse');
});

test('a typed % or _ in the search box is data, not a wildcard', () => {
  assert.equal(likeTerm('50% off'), '%50\\% off%');
  assert.equal(likeTerm('a_b'), '%a\\_b%');
  assert.equal(likeTerm('plain'), '%plain%');
  const { text } = buildList(q({ q: '%' }));
  assert.match(text, /ESCAPE '\\'/);
});

test('sort keys map to a typed expression, and unknown keys cannot reach SQL', () => {
  assert.equal(sortOf('context').dir, 'desc');
  assert.match(sortOf('context').expr, /COALESCE\(m\."contextWindow", -1\)/);
  assert.match(sortOf('priceLow').expr, /COALESCE\(a\."minPrompt", 999999999999\)/);
  assert.equal(sortOf('priceLow').cast, 'numeric');
  assert.equal(sortOf('drop table models').expr, sortOf('released').expr, 'unknown sort falls back, never through');
  assert.equal(sortOf('name').dir, 'asc');
});

test('the cursor compares on the same expression the query sorts on', () => {
  const { text, values } = buildList(q({ sort: 'context', cursor: encodeCursor('262144', 'model-id-9') }));
  assert.match(text, /\(COALESCE\(m\."contextWindow", -1\), m\.id\) < \(\$1::int, \$2::text\)/);
  // The LIMIT is a parameter too, and it comes last: order is filters, cursor, limit.
  assert.deepEqual(values, ['262144', 'model-id-9', 26]);
});

test('a garbage cursor is ignored instead of throwing a 500', () => {
  assert.equal(decodeCursor('not base64 at all $$'), null);
  assert.equal(decodeCursor(encodeCursor(null, 'x')), null, 'an empty sort value is not one of ours');
  assert.deepEqual(decodeCursor(encodeCursor('2026-11-07', 'x')), { v: '2026-11-07', id: 'x' });
});

test('limit+1 is what the route reads to decide there is a next page', () => {
  const { values } = buildList(q({ limit: 25 }));
  assert.equal(values.at(-1), 26);
});

test('the ranking query always excludes deprecated models and pages by offset', () => {
  const { text, values } = buildRanking({ benchmark: 'aa_intelligence', category: 'reasoning', limit: 50, offset: 100 });
  assert.match(text, /m\."deprecatedAt" IS NULL/);
  assert.deepEqual(values, ['aa_intelligence', 'reasoning', 50, 100]);
  assert.match(text, /ORDER BY s\.score DESC, m\.id ASC/);
});

test('filters the API cannot express are rejected before SQL, not inside it', () => {
  assert.throws(() => q({ sort: 'whatever' }));
  assert.throws(() => q({ limit: 5000 }));
  assert.throws(() => q({ minContext: -1 }));
  // unknown capability tokens are dropped by the transform rather than becoming a column name
  assert.deepEqual(q({ capabilities: 'tools,notacolumn' }).capabilities, ['tools']);
});
