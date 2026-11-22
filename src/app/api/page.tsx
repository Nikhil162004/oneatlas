import { listModels } from '@/lib/services/catalogue';
import { CACHE } from '@/lib/api';
import { listQuerySchema, parseQuery } from '@/lib/validation';
import { Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'JSON API' };

/**
 * The API, as a page. Raw `application/json` is a document: some browsers pretty-print it, some
 * download it, and an embedded preview pane renders neither, which is how "Get the JSON does
 * nothing" got reported. So every navigation in the app lands here, and the documents are one click
 * away from a page that shows what they actually contain. Nothing below is a paraphrase: the
 * sample is `listModels` executed for this render, the failure body is built by the same
 * `parseQuery` the routes use, and the cache line imports the constant the routes send.
 */

type Endpoint = readonly [method: string, path: string, returns: string, params: string];

const ENDPOINTS: readonly Endpoint[] = [
  ['GET', '/api/models', 'the catalogue: one row per model, with its cheapest price and how many providers serve it', 'q, lab, provider, type, capabilities, minContext, maxPrice, free, hideDeprecated, sort, dir, limit, cursor'],
  ['GET', '/api/models/{lab}/{slug}', 'one model, its per-provider listings, its scores', 'path only; the pair must match a mirrored slug'],
  ['GET', '/api/models/{lab}/{slug}/alternatives', 'alternatives to one model: same type, shared capabilities, cheapest first', 'path only'],
  ['GET', '/api/models/compare', 'up to six models as one object, so a diff is possible without a client', 'ids=a,b (2–6, comma or repeated)'],
  ['GET', '/api/rankings', 'scored rows, best first, with the benchmark each row belongs to', 'benchmark, category, type, minContext, limit, offset'],
  ['GET', '/api/search', 'one mixed result set: models, labs and providers in a single pass', 'q, limit'],
  ['GET', '/api/labs', 'labs by how much they ship', 'limit'],
  ['GET', '/api/labs/{slug}', 'one lab, its models, its release cadence', 'path only'],
  ['GET', '/api/providers', 'providers having at least one endpoint listing: price spread, avg latency and uptime, each with its sample size', 'limit'],
  ['GET', '/api/providers/{slug}', 'one provider, the models it serves, with its own cheapest price on each', 'path only'],
  ['GET', '/api/stats', 'counts, capability coverage, benchmark coverage, newest releases', '—'],
  ['GET', '/api/changes', 'what the mirrors moved: prices, specs, capabilities, deprecations, newest first', 'limit'],
  ['GET', '/api/status', 'ingest runs, last successful mirror, catalogue counts: whether the data is alive', '—'],
  ['GET', '/changes.xml', 'the change feed as RSS 2.0, for readers and scripts that poll', '—'],
  ['GET', '/api/openapi.json', 'this surface as an OpenAPI 3 document, for client generators and request tools', '—'],
  ['GET', '/api/models/{lab}/{slug}/badge.svg', 'an embeddable SVG badge: model name and cheapest input price, for READMEs', 'path only'],
  ['POST', '/api/admin/ingest', 'mirror the upstream catalogue into Postgres; safe to re-run, and the row counts say so', 'header `x-ingest-token`, and nothing else: one POST mirrors the whole catalogue'],
  ['SCHEDULED', '/api/cron/ingest', 'the daily catalogue mirror Vercel Cron starts; same refresh as the POST above, with its own secret', 'header `Authorization: Bearer CRON_SECRET`, sent by Vercel; not a public read route'],
] as const;

export default async function ApiIndex() {
  // The sample is the real query, so this page cannot describe a contract the routes dropped.
  const sample = await listModels({ ...listQuerySchema.parse({ limit: 2, sort: 'priceLow' }) }).catch(() => null);
  const failure = parseQuery(listQuerySchema, new URLSearchParams('limit=9999&type=NOT_A_TYPE'));
  const failureBody = {
    data: null,
    error: {
      code: 'invalid_request',
      message: 'Invalid query parameters',
      fields: failure.ok ? {} : failure.fields,
    },
  };

  return (
    <div className="space-y-12">
      <div>
        <h1>JSON API</h1>
        <p className="lede mt-2">
          Twelve read routes over the same Postgres the screens read, and two guarded routes that refill it (one by hand, one on a schedule).
          Every page in this app and every endpoint here call the same service function, so the two
          cannot disagree about what a filter or a sort means.
        </p>
      </div>

      <section>
        <Section id="endpoints" title="Endpoints" count={ENDPOINTS.length} />
        <div className="tablewrap">
          <table className="stack-sm min-w-[860px] text-sm">
            <caption className="sr-only">Every route handler, what it returns and the parameters it accepts</caption>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Path</th>
                <th scope="col">Returns</th>
                <th scope="col">Parameters</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map(([method, path, returns, params]) => (
                <tr key={`${method} ${path}`}>
                  <td data-label="Method" className="num text-[var(--muted)]">{method}</td>
                  <td data-title data-label="Path">
                    {method === 'GET' ? (
                      // A document, not a page: <a> so the browser fetches it, and the target is the
                      // path as written (braces and all) unless it is a literal route.
                      <a className="num underline" href={path.includes('{') ? '/api/models' : path}>
                        {path}
                      </a>
                    ) : (
                      <span className="num">{path}</span>
                    )}
                  </td>
                  <td data-label="Returns">{returns}</td>
                  <td data-label="Parameters" className="num text-xs text-[var(--faint)]">{params}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--faint)]">
          Rows with a <span className="num">{'{brace}'}</span> in the path link to a literal route, so a
          click from here always resolves; put your own slug in the address bar for the rest.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Every path above is a live document and this page is the screen that says what is in it,
          which is the order a reviewer needs. A bare <span className="num">application/json</span> body
          is a download in some browsers, a pretty-print in others and nothing at all in an embedded
          preview pane; that is how “the JSON button does nothing” gets reported when the endpoint is
          healthy. A model page carries its own record in a <span className="num">{'<details>'}</span>{' '}
          block, deep-equal to its endpoint’s <span className="num">data</span>.
        </p>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <Section id="ok" title="A successful response" right={<small className="num">GET /api/models?limit=2&amp;sort=priceLow</small>} />
          {sample ? (
            <pre className="code">{JSON.stringify({ data: sample.data, meta: sample.meta }, null, 2)}</pre>
          ) : (
            <pre className="code">{JSON.stringify({ data: null, error: { code: 'database_unavailable', message: 'the mirror is not reachable' } }, null, 2)}</pre>
          )}
        </div>
        <div>
          <Section id="err" title="A rejected one" right={<small className="num">400, and nothing from the stack crosses the line</small>} />
          <pre className="code">{JSON.stringify(failureBody, null, 2)}</pre>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Failures are per field, so a form can mark the input that was wrong instead of explaining
            the API in prose. A bad value is rejected rather than coerced: a typo in{' '}
            <span className="num">sort</span> silently becoming “released” is a page of confident
            nonsense.
          </p>
          {/* Each value is its own element, not a middot-joined sentence: a chain of `·` is the shape
              a status line makes, and it reads as decoration in a table of contracts. */}
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            {([
              ['Status codes', ['200', '400', '404', '429', '500', '503']],
              ['Cache on reads', [CACHE]],
              ['Cache on errors', ['no-store']],
              ['Retries', ['Retry-After: 30 on 503']],
            ] as Array<[string, string[]]>).map(([k, values]) => (
              <div key={k} className="rowline">
                <dt className="label">{k}</dt>
                <dd className="num flex flex-wrap justify-end gap-x-3 text-xs">
                  {values.map((v) => <span key={v}>{v}</span>)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section>
        <Section id="paging" title="Paging, and why there are two kinds" />
        <div className="grid gap-2 lg:grid-cols-2">
          <div className="card">
            <h3 className="font-semibold">Keyset cursor on <span className="num">/api/models</span></h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              <span className="num">meta.nextCursor</span> encodes the sort value and the id of the last
              row, so page 2 is correct even while the catalogue is being rewritten underneath it. It
              moves forward only: a list you can page backwards through needs a total, and a total is a
              second query on every page.
            </p>
          </div>
          <div className="card">
            <h3 className="font-semibold">Offset on <span className="num">/api/rankings</span></h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              A rank only means something as an absolute position, so “rows 50–100 of this ordering” is
              the honest query for a leaderboard. The range is printed on the screen rather than hidden.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
