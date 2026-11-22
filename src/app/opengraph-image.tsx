import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'OneAtlas: AI model discovery';

/** The site-wide share card; model pages override it with their own numbers. */
export default function Image() {
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
          <div style={{ display: 'flex', fontSize: 62, fontWeight: 600, lineHeight: 1.15 }}>Discover, compare and evaluate AI models</div>
          <div style={{ display: 'flex', fontSize: 30, color: '#a6aebd', marginTop: 18 }}>Prices, benchmarks and providers, mirrored daily from the public catalogue.</div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#a6aebd' }}>476 models, 82 providers, and a daily change feed</div>
      </div>
    ),
    size,
  );
}
