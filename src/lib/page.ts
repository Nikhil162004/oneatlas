/**
 * The only plumbing the pages need: a GET form and a hand-typed link both land in `searchParams`,
 * and both have to reach the same parser the API routes use. Anything cleverer would be a second
 * source of truth about what a URL means.
 */

export type RawParams = Record<string, string | string[] | undefined>;

export function toSearchParams(raw: RawParams): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      // A checkbox group submits `capabilities=tools&capabilities=vision`; the query schema wants a
      // comma list, so join rather than let the last value win silently.
      if (v.length) sp.set(k, v.join(','));
    } else if (v !== undefined) {
      sp.set(k, v);
    }
  }
  return sp;
}

/** Change one thing, keep the rest: how a sort header or a filter tab stays non-destructive. */
export function hrefWith(raw: RawParams, changes: Record<string, string | null>, path = ''): string {
  const sp = toSearchParams(raw);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) sp.delete(k);
    else sp.set(k, v);
  }
  const q = sp.toString();
  return `${path}${q ? `?${q}` : ''}`;
}
