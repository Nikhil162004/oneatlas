import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi';

export const dynamic = 'force-dynamic';

/** GET /api/openapi.json — the OpenAPI document (src/lib/openapi.ts) as raw JSON for client
 * generators and request tools. Humans get the same object rendered at /openapi. */
export function GET() {
  return NextResponse.json(openApiSpec, { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
}
