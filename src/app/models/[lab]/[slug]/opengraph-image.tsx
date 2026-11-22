import { ImageResponse } from 'next/og';
import { modelDetail } from '@/lib/services/catalogue';
import { priceLabel, contextLabel } from '@/lib/format';

// Prisma cannot run on the edge; the card is generated where the database is reachable.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'OneAtlas model card';

/**
 * The share card for a model link: name, lab, cheapest mirrored input price and context,
 * rendered by the app from the same record the page shows. A pasted link therefore unfurls
 * with the model's actual numbers, which go stale only as fast as the mirror itself.
 */
export default async function Image({ params }: { params: Promise<{ lab: string; slug: string }> }) {
  const { lab, slug } = await params;
  const model = await modelDetail(lab, slug).catch(() => null);
  const name = model?.name ?? 'OneAtlas';
  const labName = model?.lab.name ?? 'AI model catalogue';
  const prices = (model?.providers ?? []).map((p) => p.per1M.prompt).filter((v): v is number => v !== null);
  const price = prices.length ? priceLabel(Math.min(...prices)) : 'price n/a';
  const context = model ? contextLabel(model.contextWindow) : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0c11',
          color: '#e8eaf0',
          padding: 64,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: '#94a7d9', letterSpacing: -0.5 }}>
          one<span style={{ color: '#e8eaf0' }}>atlas</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 600, lineHeight: 1.1 }}>{name}</div>
          <div style={{ display: 'flex', fontSize: 30, color: '#a6aebd', marginTop: 16 }}>{labName}</div>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 28, color: '#a6aebd' }}>
          <div style={{ display: 'flex', border: '1px solid #2a3242', borderRadius: 8, padding: '10px 18px' }}>{`${price} in / 1M`}</div>
          {context ? (
            <div style={{ display: 'flex', border: '1px solid #2a3242', borderRadius: 8, padding: '10px 18px' }}>{`${context} context`}</div>
          ) : null}
          <div style={{ display: 'flex', border: '1px solid #2a3242', borderRadius: 8, padding: '10px 18px' }}>live mirrored price</div>
        </div>
      </div>
    ),
    size,
  );
}
