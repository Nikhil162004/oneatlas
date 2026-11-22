import { modelDetail } from '@/lib/services/catalogue';

export const dynamic = 'force-dynamic';

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * GET /api/models/{lab}/{slug}/badge.svg — a shields-style badge for READMEs and docs: the
 * model's name and its cheapest mirrored input price. The price is read from the same listings
 * the model page shows, so a badge can only ever quote a number the site itself displays.
 * Widths are estimated from character counts (11px Verdana averages ~6.6px a glyph); a badge is
 * a label, not typography, and a pixel of slack beats a clipped price.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ lab: string; slug: string }> }) {
  const { lab, slug } = await params;
  const model = await modelDetail(lab, slug).catch(() => null);
  if (!model) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });

  const prices = model.providers.map((p) => p.per1M.prompt).filter((v): v is number => v !== null);
  const cheapest = prices.length ? Math.min(...prices) : null;
  const value = cheapest !== null ? `$${cheapest > 0 && cheapest < 0.01 ? cheapest.toFixed(4) : cheapest.toFixed(2)}/1M in` : 'no price mirrored';
  const label = model.name;
  const leftW = Math.ceil(label.length * 6.6) + 14;
  const rightW = Math.ceil(value.length * 6.6) + 14;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${leftW + rightW}" height="20" role="img" aria-label="${esc(`${label}: ${value}`)}">
  <rect width="${leftW}" height="20" rx="3" fill="#24292e"/>
  <rect x="${leftW - 3}" width="${rightW + 3}" height="20" rx="3" fill="#74e0a4"/>
  <text x="${leftW / 2}" y="14" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" fill="#ffffff">${esc(label)}</text>
  <text x="${leftW + rightW / 2}" y="14" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" fill="#10231a">${esc(value)}</text>
</svg>
`;
  return new Response(svg, {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300' },
  });
}
