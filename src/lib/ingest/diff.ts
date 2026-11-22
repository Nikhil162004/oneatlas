/**
 * What changed between the mirror we have and the mirror that just arrived.
 *
 * A catalogue that updates itself daily is only trustworthy if it can say what moved: a price
 * that doubled overnight and a context window that quietly shrank are exactly the facts a
 * comparison site exists to surface, and they are invisible if every ingest just overwrites.
 * So persistence snapshots the affected rows first, upserts, then diffs — the events land in
 * ChangeEvent next to the IngestRun that caused them (see persist.ts), and /changes reads them.
 *
 * Only facts a reader acts on are tracked: prices on listings that already existed (a provider
 * starting to serve a model is catalogue growth, not a change), model specs, capabilities,
 * deprecation, and a model appearing at all. Pure functions over plain snapshots: the database
 * reads happen in persist.ts, the decisions happen here, and here is what the tests pin down.
 */

export type ModelSnapshot = {
  slug: string;
  contextWindow: number;
  maxOutputTokens: number | null;
  supportsReasoning: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVisionInput: boolean;
  openWeights: boolean;
  deprecatedAt: string | null; // ISO date, or null while the model is current
};

export type ListingSnapshot = {
  modelSlug: string;
  providerSlug: string;
  endpointName: string;
  promptPer1M: string | null;
  completionPer1M: string | null;
};

export type ChangeDraft = {
  modelSlug: string;
  field: string;
  detail: string | null;
  oldValue: string | null;
  newValue: string | null;
};

const CAPABILITIES: ReadonlyArray<readonly [keyof ModelSnapshot, string]> = [
  ['supportsReasoning', 'reasoning'],
  ['supportsToolCalling', 'tool calling'],
  ['supportsStructuredOutput', 'structured output'],
  ['supportsVisionInput', 'vision input'],
  ['openWeights', 'open weights'],
];

const num = (v: number | null) => (v === null ? null : String(v));
const bool = (v: boolean) => (v ? 'yes' : 'no');
const priceChanged = (a: string | null, b: string | null) => {
  if (a === null || b === null) return a !== b;
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.abs(x - y) > 1e-9 : a !== b;
};

export function modelChanges(before: ModelSnapshot | undefined, after: ModelSnapshot): ChangeDraft[] {
  if (!before) return [{ modelSlug: after.slug, field: 'model added', detail: null, oldValue: null, newValue: after.slug }];
  const out: ChangeDraft[] = [];
  const push = (field: string, oldValue: string | null, newValue: string | null) =>
    out.push({ modelSlug: after.slug, field, detail: null, oldValue, newValue });

  if (before.contextWindow !== after.contextWindow) push('context window', num(before.contextWindow), num(after.contextWindow));
  if (before.maxOutputTokens !== after.maxOutputTokens) push('max output', num(before.maxOutputTokens), num(after.maxOutputTokens));
  for (const [key, label] of CAPABILITIES) {
    if (before[key] !== after[key]) push(label, bool(before[key] as boolean), bool(after[key] as boolean));
  }
  if ((before.deprecatedAt === null) !== (after.deprecatedAt === null)) {
    push(after.deprecatedAt === null ? 'reinstated' : 'deprecated', bool(before.deprecatedAt !== null), bool(after.deprecatedAt !== null));
  }
  return out;
}

export function listingChanges(before: ListingSnapshot | undefined, after: ListingSnapshot): ChangeDraft[] {
  // A listing that did not exist yesterday is growth, not a change; only re-pricing is news.
  if (!before) return [];
  const detail = `${after.providerSlug} · ${after.endpointName}`;
  const out: ChangeDraft[] = [];
  if (priceChanged(before.promptPer1M, after.promptPer1M)) {
    out.push({ modelSlug: after.modelSlug, field: 'input price', detail, oldValue: before.promptPer1M, newValue: after.promptPer1M });
  }
  if (priceChanged(before.completionPer1M, after.completionPer1M)) {
    out.push({ modelSlug: after.modelSlug, field: 'output price', detail, oldValue: before.completionPer1M, newValue: after.completionPer1M });
  }
  return out;
}

export const listingKey = (l: ListingSnapshot) => `${l.modelSlug}|${l.providerSlug}|${l.endpointName}`;

/** A runaway source must not flood the feed; the run row keeps the true upsert counts regardless. */
export const MAX_EVENTS_PER_RUN = 5000;

export function diffCatalogue(
  beforeModels: ReadonlyMap<string, ModelSnapshot>,
  beforeListings: ReadonlyMap<string, ListingSnapshot>,
  models: readonly ModelSnapshot[],
  listings: readonly ListingSnapshot[],
): ChangeDraft[] {
  const out: ChangeDraft[] = [];
  for (const m of models) out.push(...modelChanges(beforeModels.get(m.slug), m));
  for (const l of listings) out.push(...listingChanges(beforeListings.get(listingKey(l)), l));
  return out.slice(0, MAX_EVENTS_PER_RUN);
}
