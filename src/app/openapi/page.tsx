import { openApiSpec } from '@/lib/openapi';
import { SITE_URL } from '@/lib/site';
import { Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'OpenAPI document' };

type Param = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: { type?: string; description?: string };
};
type Operation = {
  summary?: string;
  parameters?: Param[];
  responses?: Record<string, { description?: string }>;
};
type Spec = {
  openapi: string;
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: Record<
      string,
      { type?: string; required?: string[]; properties?: Record<string, { type?: string; description?: string }> }
    >;
  };
};

const spec = openApiSpec as unknown as Spec;
const operations = Object.entries(spec.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => ({ path, method, op })),
);
const envelope = spec.components.schemas['Envelope'];

/**
 * The OpenAPI document as documentation, not as a file. GET /api/openapi.json serves the
 * spec object as raw JSON for client generators and request tools; this page renders the
 * same object (src/lib/openapi.ts) as readable endpoint documentation, because a browser
 * sent to a bare .json URL may download it or show an unformatted wall of text. The two
 * renderings share one object, so they cannot describe different contracts.
 */
export default function OpenApiPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1>OpenAPI document</h1>
        <p className="lede mt-2 max-w-[72ch]">{spec.info.description}</p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <span className="tag">OpenAPI {spec.openapi}</span>
          <span className="tag">Version {spec.info.version}</span>
          <span>
            Tools want the file itself: <a className="underline" href={`${SITE_URL}/api/openapi.json`}>raw JSON</a>.
            Routes you can run in the browser live on the <a className="underline" href="/api">API page</a>.
          </span>
        </p>
      </div>

      <section>
        <Section id="endpoints" title="Endpoints" count={operations.length} />
        <div className="space-y-3">
          {operations.map(({ path, method, op }) => (
            <article key={`${method}-${path}`} className="card card-tight">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tag num">{method.toUpperCase()}</span>
                <span className="num font-medium">/api{path}</span>
                {op.summary && <span className="text-sm text-[var(--muted)]">{op.summary}</span>}
              </p>
              {op.parameters && op.parameters.length > 0 && (
                <div className="tablewrap mt-3">
                  <table className="text-sm">
                    <caption className="sr-only">Parameters for {method.toUpperCase()} {path}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Parameter</th>
                        <th scope="col">Where</th>
                        <th scope="col">Type</th>
                        <th scope="col">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {op.parameters.map((p) => (
                        <tr key={`${p.in}-${p.name}`}>
                          <td className="num" data-title>{p.name}{p.required ? ' (required)' : ''}</td>
                          <td>{p.in}</td>
                          <td className="num">{p.schema?.type ?? 'string'}</td>
                          <td className="text-[var(--muted)]">{p.description ?? p.schema?.description ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {op.responses && (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {Object.entries(op.responses).map(([code, r]) => (
                    <span key={code} className="num">{code}: {r.description}</span>
                  ))}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      {envelope?.properties && (
        <section>
          <Section id="envelope" title="The envelope" right={<small>every response, success or failure</small>} />
          <div className="tablewrap">
            <table className="text-sm">
              <caption className="sr-only">Fields of the response envelope</caption>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Type</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(envelope.properties).map(([name, prop]) => (
                  <tr key={name}>
                    <td className="num" data-title>{name}{envelope.required?.includes(name) ? ' (required)' : ''}</td>
                    <td className="num">{prop.type ?? 'any'}</td>
                    <td className="text-[var(--muted)]">{prop.description ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
