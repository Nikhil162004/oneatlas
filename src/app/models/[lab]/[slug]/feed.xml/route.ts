import { modelDetail, modelHistory } from '@/lib/services/catalogue';

export const dynamic = 'force-dynamic';

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * GET /models/{lab}/{slug}/feed.xml — one model's recorded moves as RSS 2.0: follow a single
 * model's prices in a reader instead of the whole firehose at /changes.xml. Same ChangeEvent
 * rows the History section renders, so the feed and the page cannot tell different stories.
 */
export async function GET(request: Request, { params }: { params: Promise<{ lab: string; slug: string }> }) {
  const { lab, slug } = await params;
  const model = await modelDetail(lab, slug).catch(() => null);
  if (!model) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  const base = new URL(request.url).origin;
  const { data } = await modelHistory(lab, slug, 50);
  const items = data
    .map((c) => {
      const title = `${model.name}: ${c.field}${c.detail ? ` (${c.detail})` : ''}`;
      const desc = `${c.oldValue ?? '—'} → ${c.newValue ?? '—'}${c.pctChange !== null ? ` (${c.pctChange > 0 ? '+' : ''}${c.pctChange.toFixed(1)}%)` : ''}`;
      return `    <item><title>${esc(title)}</title><link>${base}/models/${esc(model.slug)}</link><guid isPermaLink="false">${esc(c.id)}</guid><pubDate>${new Date(c.at).toUTCString()}</pubDate><description>${esc(desc)}</description></item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>OneAtlas: ${esc(model.name)} changes</title>
    <link>${base}/models/${esc(model.slug)}</link>
    <description>Price, spec and capability changes recorded for ${esc(model.name)} between OneAtlas catalogue mirrors.</description>
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}
