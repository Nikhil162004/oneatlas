import { changesFeed } from '@/lib/services/catalogue';

export const dynamic = 'force-dynamic';

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * GET /changes.xml — the change feed as RSS 2.0, so a mirror moving a price can arrive in a
 * reader instead of waiting to be visited. Same rows, same order as GET /api/changes; the feed
 * is generated per request from the database, not written to disk by the ingest, so it can never
 * be a stale copy of the feed it describes. Served as application/xml rather than
 * application/rss+xml: Blink refuses to apply the browser stylesheet to feed MIME types, and
 * readers sniff the <rss> content either way, so the generic type is what lets a human open
 * the feed and a reader keep polling it.
 */
export async function GET(request: Request) {
  const base = new URL(request.url).origin;
  const { data } = await changesFeed(50);
  const items = data
    .map((c) => {
      const title = `${c.modelSlug}: ${c.field}${c.detail ? ` (${c.detail})` : ''}`;
      const desc = `${c.oldValue ?? '—'} → ${c.newValue ?? '—'}${c.pctChange !== null ? ` (${c.pctChange > 0 ? '+' : ''}${c.pctChange.toFixed(1)}%)` : ''} · run: ${c.source}`;
      return `    <item><title>${esc(title)}</title><link>${base}/models/${esc(c.modelSlug)}</link><guid isPermaLink="false">${esc(c.id)}</guid><pubDate>${new Date(c.at).toUTCString()}</pubDate><description>${esc(desc)}</description></item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>
<rss version="2.0">
  <channel>
    <title>OneAtlas changes</title>
    <link>${base}/changes</link>
    <description>Prices, specs and capabilities that moved between OneAtlas catalogue mirrors.</description>
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}
