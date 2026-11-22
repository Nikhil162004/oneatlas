/**
 * Shared HTTP plumbing: one response envelope, one error mapping, one cache policy.
 *
 * The envelope is not decoration. A client that has to guess whether `{ models: null }` means
 * "empty result" or "the database is down" is the difference between an empty state and a white
 * screen, and there is no way for the caller to tell. So: always `data`, always `meta`, `error`
 * only on failure, and nothing from the stack ever reaches the browser.
 */

import { NextResponse } from 'next/server';
export type { ModelListItem } from './present';
import { Prisma } from '@prisma/client';

export const CACHE = 'public, s-maxage=300, stale-while-revalidate=3600';

export type Envelope<T> = { data: T; meta: Record<string, unknown>; error?: undefined };

export function ok<T>(data: T, meta: Record<string, unknown> = {}, cache = CACHE) {
  return NextResponse.json({ data, meta }, { headers: { 'cache-control': cache } });
}

export function fail(status: 400 | 404 | 429 | 500 | 503, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { data: null, error: { code: CODE[status], message, ...extra } },
    { status, headers: status === 503 ? { 'retry-after': '30', 'cache-control': 'no-store' } : { 'cache-control': 'no-store' } },
  );
}

const CODE: Record<number, string> = {
  400: 'invalid_request',
  404: 'not_found',
  429: 'rate_limited',
  500: 'internal_error',
  503: 'database_unavailable',
};

export function badRequest(fields: Record<string, string[] | undefined> | undefined, message = 'Invalid query parameters') {
  return fail(400, message, { fields });
}

/**
 * Map the failure modes we can actually hit to a status, and log the rest with the original error
 * for whoever is reading server logs. Unknown shapes must not become a 200 with empty data.
 */
export function handle(err: unknown, context: string) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025 = record not found on a read that assumed existence.
    if (err.code === 'P2025') return fail(404, 'Not found');
    console.error(`[${context}] prisma ${err.code}`, err.meta ?? err.message);
    return fail(503, 'Database unavailable');
  }
  if (err instanceof Prisma.PrismaClientInitializationError || isConnectionError(err)) {
    console.error(`[${context}] database unreachable`, (err as Error).message);
    return fail(503, 'Database unavailable');
  }
  console.error(`[${context}] unhandled`, err);
  return fail(500, 'Internal error');
}

function isConnectionError(err: unknown) {
  const msg = String((err as Error)?.message ?? '');
  return /ECONNREFUSED|ETIMEDOUT|P1001|Can't reach database|connection terminated/i.test(msg);
}

/**
 * Wraps a handler so the try/catch cannot be forgotten per endpoint. The second argument is
 * Next's route context ({ params }) and has to be forwarded — swallowing it is how every dynamic
 * route silently becomes `undefined`.
 */
export function route<C>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return handle(err, handler.name || 'route');
    }
  };
}

export { presentRow, type ListRow } from './present';
