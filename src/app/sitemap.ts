import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BASE = process.env.SITE_URL ?? 'https://oneatlas-smoky.vercel.app';

/**
 * Every public route, generated from the mirror itself: static screens plus one URL per model,
 * lab, provider and benchmark. Generated per request from the database rather than written at
 * build time, so a model mirrored tonight is discoverable tomorrow without a redeploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [models, labs, providers, benchmarks] = await Promise.all([
    prisma.model.findMany({ select: { slug: true } }),
    prisma.lab.findMany({ select: { slug: true } }),
    prisma.provider.findMany({ select: { slug: true } }),
    prisma.benchmark.findMany({ select: { slug: true } }),
  ]);
  const at = (path: string) => ({ url: `${BASE}${path}` });
  return [
    at('/'),
    at('/models'),
    at('/rankings'),
    at('/benchmarks'),
    at('/compare'),
    at('/calculator'),
    at('/labs'),
    at('/providers'),
    at('/changes'),
    at('/status'),
    at('/api'),
    ...models.map((m) => at(`/models/${m.slug}`)),
    ...labs.map((l) => at(`/labs/${l.slug}`)),
    ...providers.map((p) => at(`/providers/${p.slug}`)),
    ...benchmarks.map((b) => at(`/benchmarks/${b.slug}`)),
  ];
}
