/** Display formatting. Kept out of the services so they return numbers, not strings. */

/** 1048576 -> "1.05M", 262144 -> "262K", null -> em dash. Matches how the live product writes it. */
export function contextLabel(n: number | null | undefined): string {
  if (!n || n <= 0) return EMDASH;
  if (n >= 1_000_000) return `${magnitude(n / 1_000_000)}M`;
  if (n >= 1_000) return `${magnitude(n / 1_000)}K`;
  return String(n);
}

const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, '');

/* A context window is a magnitude, not a measurement: 262.14K reads as a mistake when nobody ships
   a 262,140-token model on purpose. Fewer significant digits as the number grows, so a column of
   them is quiet. Prices do the opposite (two decimals always), because those align on a point. */
const magnitude = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1).replace(/\.0$/, '') : trim(x));

/** null is unknown, not free: "—" and "Free" have to stay different on screen too. */
export function priceLabel(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return EMDASH;
  if (n === 0) return 'Free';
  // Two decimals always, so a column of prices lines up on the decimal point; below a cent the
  // digits that matter are further out, so that band keeps its precision.
  if (n < 0.01) return `$${n.toFixed(5).replace(/0+$/, '').replace(/\.$/, '.0')}`;
  return `$${n.toFixed(2)}`;
}

export function pricePair(prompt: number | null, completion: number | null): string {
  if (prompt === null && completion === null) return EMDASH;
  if (prompt === 0 && completion === 0) return 'Free';
  return `${priceLabel(prompt)} / ${priceLabel(completion)}`;
}

/** Deterministic across server and browser: fixed locale, fixed zone, so markup does not shift. */
const dateFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
export function dateLabel(d: Date | string | null | undefined): string {
  if (!d) return EMDASH;
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? EMDASH : dateFmt.format(date);
}

/** Intl units are locale-aware and read better than "ms"/"tps" in a table. */
export const msLabel = (n: number | null | undefined) => (n === null || n === undefined ? EMDASH : `${n} ms`);
export const pctLabel = (n: number | null | undefined) => (n === null || n === undefined ? EMDASH : `${n.toFixed(2)}%`);

export const EMDASH = '\u2014';
