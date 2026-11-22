/**
 * Plumbing for the client islands (docs/decisions/0008). Three rules keep them honest:
 *
 * 1. The URL is still the state. An island never holds a query the URL does not say; it fetches
 *    `/api/...` with the exact query string it then writes back with `history.pushState`, so a
 *    refresh, a pasted link and the API all describe the same view.
 * 2. The first paint is the server's. Islands mount on server-rendered rows and only fetch on
 *    interaction, so the document a crawler (or `npm run smoke`) reads is the real table.
 * 3. No island invents a query language. The params it sends are the ones the page's own form
 *    would have submitted, validated by the same Zod schema on the route.
 */

type Envelope<T, M> = { data: T; meta: M; error?: { message?: string; fields?: Record<string, unknown> } };

/** Fetch one of this app's route handlers and unwrap the envelope, or throw its error message. */
export async function fetchApi<T, M>(path: string, signal: AbortSignal): Promise<{ data: T; meta: M }> {
  const res = await fetch(path, { signal, headers: { accept: 'application/json' } });
  const body = (await res.json().catch(() => null)) as Envelope<T, M> | null;
  if (!res.ok || !body || body.error) {
    const fields = body?.error?.fields ? ` (${Object.keys(body.error.fields).join(', ')})` : '';
    throw new Error(`${body?.error?.message ?? `Request failed (${res.status})`}${fields}`);
  }
  return { data: body.data, meta: body.meta };
}

/** Write the query into the address bar without a navigation: no document load, no scroll reset. */
export function syncUrl(path: string, params: URLSearchParams) {
  const qs = params.toString();
  window.history.pushState(null, '', qs ? `${path}?${qs}` : path);
}

/** Intercept clicks on anchors that only change the query (chips, sort headers, pagers). */
export function queryFromAnchor(anchor: HTMLAnchorElement): URLSearchParams {
  return new URL(anchor.href, window.location.origin).searchParams;
}
