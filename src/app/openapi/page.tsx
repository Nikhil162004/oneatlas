import { openApiSpec } from '@/lib/openapi';
import { SITE_URL } from '@/lib/site';
import { Section } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'OpenAPI document' };

/**
 * The OpenAPI document, readable. GET /api/openapi.json serves the same object as raw JSON
 * for client generators and request tools, but a browser sent to a bare .json URL may hand
 * the reader a download instead of a page, so the footer's human link lands here: the spec
 * pretty-printed, with the raw file one click away for the tools that actually want a file.
 */
export default function OpenApiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1>OpenAPI document</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The whole read surface as an OpenAPI 3 document, rendered for reading. Tools want the file itself:{' '}
          <a className="underline" href={`${SITE_URL}/api/openapi.json`}>raw JSON</a>. Routes you can run in
          the browser live on the <a className="underline" href="/api">API page</a>.
        </p>
      </div>
      <section>
        <Section id="spec" title="Spec" right={<small>OpenAPI {openApiSpec.openapi}</small>} />
        <pre className="snippet overflow-auto">{JSON.stringify(openApiSpec, null, 2)}</pre>
      </section>
    </div>
  );
}
