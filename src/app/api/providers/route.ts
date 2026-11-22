import { listProviders } from '@/lib/services/catalogue';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic'; // reads ?limit=

/** GET /api/providers — the other half of module 5: who serves what, at what spread. */
export const GET = route(async function providersRoute(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 100) || 100;
  const { data, meta } = await listProviders(limit);
  return ok(data, meta);
});
