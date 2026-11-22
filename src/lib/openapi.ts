/**
 * The API surface as an OpenAPI 3 document object. Hand-maintained next to the routes it
 * describes (the read surface is a page of spec, not a codegen pipeline), rendered raw by
 * GET /api/openapi.json for tools and pretty-printed by /openapi for humans, so the two can
 * never describe different contracts. Smoke asserts every documented path answers, so the
 * spec cannot quietly drift from the surface: rename a route and a check goes red.
 */
const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });
const param = (name: string, schema: Record<string, unknown>, required = false) => ({
  name, in: 'query', required, schema,
});
const pathParam = (name: string, description: string) => ({ name, in: 'path', required: true, description, schema: { type: 'string' } });
const ok = (description: string) => ({
  '200': {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Envelope' } } },
  },
});


export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'OneAtlas API',
    version: '1.0.0',
    description:
      'AI model discovery: catalogue, model records, comparisons, benchmark rankings, labs, providers, and the change/status feeds of the daily mirror. Every response is the { data, meta } envelope described below; there is no auth on the read routes.',
  },
  servers: [{ url: '/api', description: 'this deployment' }],
  components: {
    schemas: {
      Envelope: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { description: 'the payload; shape depends on the route' },
          meta: { type: 'object', description: 'pagination and provenance for the payload' },
          error: { type: 'object', description: 'present only on failure, with code and message' },
        },
      },
    },
  },
  paths: {
    '/models': {
      get: {
        summary: 'the catalogue, filtered and sorted',
        parameters: [
          param('q', str('name or slug search')), param('lab', str('lab slug')), param('provider', str('provider slug')),
          param('type', str('model type, e.g. TEXT')), param('capabilities', str('comma list: reasoning,tools,structured,vision,open')),
          param('minContext', num('minimum context window')), param('maxPrice', num('maximum cheapest input price per 1M')),
          param('free', str('true for free models only')), param('sort', str('price | context | name | released')),
          param('limit', num('page size')), param('cursor', str('keyset cursor from meta.nextCursor')),
        ],
        responses: ok('one page of models with cheapest prices'),
      },
    },
    '/models/{lab}/{slug}': {
      get: {
        summary: 'one model: specs, per-provider listings, scores',
        parameters: [pathParam('lab', 'lab slug'), pathParam('slug', 'model slug')],
        responses: { ...ok('the model record'), '404': { description: 'no such model in the mirror' } },
      },
    },
    '/models/{lab}/{slug}/alternatives': {
      get: {
        summary: 'alternatives to one model: same type, shared capabilities, cheapest first',
        parameters: [pathParam('lab', 'lab slug'), pathParam('slug', 'model slug')],
        responses: { ...ok('up to six alternatives with the shared-capability count'), '404': { description: 'no such model in the mirror' } },
      },
    },
    '/models/{lab}/{slug}/badge.svg': {
      get: {
        summary: 'an embeddable SVG badge: model name and cheapest input price',
        parameters: [pathParam('lab', 'lab slug'), pathParam('slug', 'model slug')],
        responses: { '200': { description: 'image/svg+xml badge', content: { 'image/svg+xml': {} } }, '404': { description: 'no such model in the mirror' } },
      },
    },
    '/models/watchlist': {
      get: {
        summary: "live rows for a reader's watched slugs, with the latest recorded change each",
        parameters: [param('ids', str('a,b , up to 50 full slugs, comma-separated or repeated'), true)],
        responses: ok('watched rows in request order; unknown slugs in meta.missing'),
      },
    },
    '/models/compare': {
      get: {
        summary: 'up to six models as one object, for side-by-side diffing',
        parameters: [param('ids', str('a,b (2 to 6 full slugs, comma-separated or repeated)'), true)],
        responses: ok('selected slugs with found flags, and one row per model'),
      },
    },
    '/rankings': {
      get: {
        summary: 'benchmark leaderboard, best first',
        parameters: [
          param('benchmark', str('benchmark slug')), param('category', str('benchmark category')),
          param('type', str('model type')), param('minContext', num('minimum context window')),
          param('view', str('value ranks by score per dollar of cheapest input')), param('limit', num('page size')), param('offset', num('row offset')),
        ],
        responses: ok('scored rows with rank, benchmark and model'),
      },
    },
    '/benchmarks': { get: { summary: 'every benchmark: scored-model count and current top model', responses: ok('benchmark rows') } },
    '/benchmarks/{slug}': {
      get: { summary: 'one benchmark and every scored model, in its own direction', parameters: [pathParam('slug', 'benchmark slug')], responses: { ...ok('the benchmark profile'), '404': { description: 'no such benchmark' } } },
    },
    '/collections': { get: { summary: 'the guided-discovery sets with leaders, computed from live rows', responses: ok('collection summaries') } },
    '/collections/{slug}': {
      get: { summary: 'one collection, ranked, each row carrying the fact that placed it', parameters: [pathParam('slug', 'collection slug')], responses: { ...ok('the ranked collection'), '404': { description: 'no such collection' } } },
    },
    '/benchmarks/matrix': { get: { summary: 'most-scored models against most-populated benchmarks, best per column flagged', responses: ok('the scores grid') } },
    '/releases': { get: { summary: 'every dated release grouped by month, newest first', responses: ok('monthly release groups') } },
    '/labs': { get: { summary: 'labs by how much they ship', parameters: [param('limit', num('page size'))], responses: ok('labs with model counts') } },
    '/labs/{slug}': {
      get: { summary: "one lab: its models and release cadence", parameters: [pathParam('slug', 'lab slug')], responses: { ...ok('the lab profile'), '404': { description: 'no such lab' } } },
    },
    '/providers': { get: { summary: 'providers with endpoint listings: price spread, latency, uptime', parameters: [param('limit', num('page size'))], responses: ok('provider rows with sample sizes') } },
    '/providers/{slug}': {
      get: { summary: 'one provider: the models it serves, with its own cheapest price on each', parameters: [pathParam('slug', 'provider slug')], responses: { ...ok('the provider profile'), '404': { description: 'no such provider' } } },
    },
    '/search': {
      get: { summary: 'one mixed lookup: models, labs, providers in a single pass', parameters: [param('q', str('search term'), true), param('limit', num('per-group cap'))], responses: ok('three groups of matches') },
    },
    '/stats': { get: { summary: 'counts, capability coverage, benchmark coverage, newest releases', responses: ok('catalogue totals') } },
    '/changes': {
      get: { summary: 'what the mirrors moved: prices, specs, capabilities, deprecations, newest first', parameters: [param('limit', num('rows, 1-200'))], responses: ok('change events with pctChange on priced fields') },
    },
    '/status': { get: { summary: 'ingest runs, last successful mirror, catalogue counts', responses: ok('ingest health') } },
  },
};

