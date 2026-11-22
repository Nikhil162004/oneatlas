import { prisma } from '@/lib/db';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * GET /sitemap.xml — every public route, generated from the mirror itself: static screens
 * plus one URL per model, lab, provider and benchmark. Generated per request from the
 * database rather than written at build time, so a model mirrored tonight is discoverable
 * tomorrow without a redeploy. A route handler rather than the metadata convention so the
 * XML can carry a stylesheet: browsers render a readable list of URLs, crawlers read the
 * same XML and never apply it.
 */
export async function GET() {
  const [models, labs, providers, benchmarks] = await Promise.all([
    prisma.model.findMany({ select: { slug: true } }),
    prisma.lab.findMany({ select: { slug: true } }),
    prisma.provider.findMany({ select: { slug: true } }),
    prisma.benchmark.findMany({ select: { slug: true } }),
  ]);
  const paths = [
    '/', '/models', '/rankings', '/benchmarks', '/compare', '/calculator', '/labs', '/providers',
    '/changes', '/status', '/api',
    ...models.map((m) => `/models/${m.slug}`),
    ...labs.map((l) => `/labs/${l.slug}`),
    ...providers.map((p) => `/providers/${p.slug}`),
    ...benchmarks.map((b) => `/benchmarks/${b.slug}`),
  ];
  const body = paths.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
