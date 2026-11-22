import type { MetadataRoute } from 'next';

const BASE = process.env.SITE_URL ?? 'https://oneatlas-smoky.vercel.app';

/** Everything public is crawlable; the API documents itself at /api and needs no invitation. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
