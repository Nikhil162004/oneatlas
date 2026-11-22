/**
 * Normalisation of an upstream model catalogue into OneAtlas rows.
 *
 * Pure: no DB, no network, no Date.now() — so it is testable and a bad source can be replayed
 * from `Model.raw`. Everything here exists because the raw payload is not in the shape our
 * schema wants: token counts arrive as "128K", prices arrive per *token*, capabilities arrive as
 * a list of parameter names, and the lab has to be split out of the display name.
 *
 * Rule followed throughout: an unknown value becomes null, never 0 and never invented.
 */

export type RawPricing = { prompt?: string | number | null; completion?: string | number | null; input_cache_read?: string | number | null } | null | undefined;

export type RawModel = {
  id: string;
  canonical_slug?: string | null;
  name?: string | null;
  description?: string | null;
  created?: number | null;
  expiration_date?: string | null;
  context_length?: number | string | null;
  pricing?: RawPricing;
  architecture?: {
    modality?: string | null;
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
    tokenizer?: string | null;
  } | null;
  supported_parameters?: string[] | null;
  top_provider?: {
    name?: string | null;
    is_moderated?: boolean | null;
    max_completion_tokens?: number | string | null;
    context_length?: number | string | null;
  } | null;
  hugging_face_id?: string | null;
  benchmarks?: Record<string, unknown> | null;
};

export type RawEndpoint = {
  name?: string | null;
  provider_name?: string | null;
  model_id?: string | null;
  context_length?: number | string | null;
  max_completion_tokens?: number | string | null;
  quantization?: string | null;
  status?: string | null;
  uptime_last_1d?: number | null;
  latency_last_30m?: number | null;
  throughput_last_30m?: number | null;
  supported_parameters?: string[] | null;
  pricing?: RawPricing;
};

export type ModelType =
  | 'TEXT' | 'IMAGE' | 'EMBEDDING' | 'VIDEO' | 'SPEECH' | 'TRANSCRIPTION' | 'RERANKING' | 'REALTIME';

export type ModelRow = {
  slug: string;
  name: string;
  labSlug: string;
  labName: string;
  modelType: ModelType;
  contextWindow: number;
  maxOutputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  supportsReasoning: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVisionInput: boolean;
  openWeights: boolean;
  description: string | null;
  releaseDate: string | null; // ISO
  deprecatedAt: string | null; // ISO
  /** The untouched source object, stored on the row so a normalisation bug is replayable. */
  raw: RawModel;
};

export type ListingRow = {
  modelSlug: string;
  providerSlug: string;
  providerName: string;
  endpointName: string;
  promptPer1M: string | null;
  completionPer1M: string | null;
  cacheReadPer1M: string | null;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  quantization: string | null;
  latencyP50Ms: number | null;
  throughputTps: number | null;
  uptimePct: string | null;
  isFree: boolean;
  status: string | null;
};

export type BenchmarkRow = { slug: string; name: string; category: string; unit: string };
export type ScoreRow = { modelSlug: string; benchmarkSlug: string; score: string; sourceUrl: string | null };

export type NormaliseIssue = { modelId: string; field: string; message: string };

export type Normalised = {
  labs: Map<string, { slug: string; name: string }>;
  providers: Map<string, { slug: string; name: string }>;
  models: ModelRow[];
  listings: ListingRow[];
  benchmarks: Map<string, BenchmarkRow>;
  scores: ScoreRow[];
  issues: NormaliseIssue[];
};

/**
 * "128K" | "1.05M" | 131072 | "131072" | null -> a token count.
 *
 * K and M are read as decimal (128K = 128,000), not binary (131,072). Real upstreams ship exact
 * integers and this suffix path only exists for hand-written or scraped sources, where guessing
 * "they probably meant 2^17" invents a fact the source did not state.
 * shortcut: a source that means 128 * 1024 needs a per-source multiplier — add it to the fetcher,
 * not here, so this function stays one rule.
 */
export function tokenCount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
  const m = /^\s*([\d.]+)\s*([kKmM]?)\s*$/.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const suffix = (m[2] ?? '').toLowerCase();
  return Math.trunc(n * (suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1));
}

/** Upstream prices are per token, as decimal strings. Ours are USD per 1M tokens, as strings. */
export function perMillion(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return (n * 1_000_000).toFixed(6);
}

/** "gemini-2.5-pro" / "Gemini 2.5 Pro" / "OpenAI: GPT-5" all agree on one slug part. */
export function slugPart(input: string | null | undefined): string {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

const BENCHMARK_LABELS: Record<string, { name: string; category: string }> = {
  intelligence_index: { name: 'Artificial Analysis Intelligence Index', category: 'reasoning' },
  coding_index: { name: 'Coding Index', category: 'coding' },
  agentic_index: { name: 'Agentic Index', category: 'agents' },
  math_index: { name: 'Math Index', category: 'math' },
  finance_and_accounting_index: { name: 'Finance & Accounting Index', category: 'domain' },
  strategy_and_ops_index: { name: 'Strategy & Ops Index', category: 'domain' },
  legal_index: { name: 'Legal Index', category: 'domain' },
  healthcare_and_medical_index: { name: 'Healthcare & Medical Index', category: 'domain' },
  engineering_index: { name: 'Engineering Index', category: 'domain' },
  economics_index: { name: 'Economics Index', category: 'domain' },
  cybersecurity_index: { name: 'Cybersecurity Index', category: 'domain' },
};

function capabilitiesFrom(params: string[] | null | undefined) {
  const set = new Set((params ?? []).map((p) => p.toLowerCase()));
  return {
    supportsToolCalling: set.has('tools') || set.has('tool_choice'),
    supportsStructuredOutput: set.has('response_format') || set.has('structured_outputs'),
    supportsReasoning: set.has('reasoning') || set.has('include_reasoning'),
  };
}

function typeFrom(model: RawModel): ModelType {
  const out = (model.architecture?.output_modalities ?? []).map((s) => s.toLowerCase());
  const inp = (model.architecture?.input_modalities ?? []).map((s) => s.toLowerCase());
  const id = model.id.toLowerCase();
  // Explicit slug signals first: routers and embedders report text->text modality in some sources.
  if (id.includes('embed')) return 'EMBEDDING';
  if (id.includes('rerank')) return 'RERANKING';
  if (out.includes('audio') && inp.includes('text')) return 'SPEECH';
  if (out.includes('text') && inp.includes('audio') && !inp.includes('text')) return 'TRANSCRIPTION';
  if (out.includes('image')) return 'IMAGE';
  if (out.includes('video')) return 'VIDEO';
  return 'TEXT';
}

/** A source that writes "2026-13-45" must not take the whole run down with it. */
function safeIso(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function epochToIso(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const ms = seconds > 1e11 ? seconds : seconds * 1000; // tolerate ms-or-seconds from sources
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * One raw model -> one ModelRow + one Provider + one listing per served endpoint, + scores.
 * `endpoints` is the enrichment payload from /models/{slug}/endpoints; without it the model gets a
 * single listing from `top_provider` + top-level pricing, which keeps the default ingest to one
 * HTTP call for the whole catalogue.
 */
export function normalise(models: RawModel[], endpoints: Map<string, RawEndpoint[]> = new Map()): Normalised {
  const out: Normalised = {
    labs: new Map(),
    providers: new Map(),
    models: [],
    listings: [],
    benchmarks: new Map(),
    scores: [],
    issues: [],
  };
  const seenSlug = new Set<string>();

  for (const raw of models) {
    if (!raw || typeof raw.id !== 'string' || !raw.id) {
      out.issues.push({ modelId: String(raw?.id ?? '?'), field: 'id', message: 'missing id, row skipped' });
      continue;
    }
    const id = raw.id.trim();
    const slash = id.indexOf('/');
    if (slash <= 0 || slash === id.length - 1) {
      out.issues.push({ modelId: id, field: 'id', message: 'id is not "author/slug", row skipped' });
      continue;
    }
    const labSlug = slugPart(id.slice(0, slash));
    const modelSlug = slugPart(id.slice(slash + 1));
    if (!labSlug || !modelSlug) {
      out.issues.push({ modelId: id, field: 'id', message: 'slug normalised to empty, row skipped' });
      continue;
    }

    // Display name is usually "Lab: Model"; the lab half is our only lab name source.
    const displayName = String(raw.name ?? id.slice(slash + 1)).trim();
    const colon = displayName.indexOf(':');
    const labName = colon > 0 ? displayName.slice(0, colon).trim() : labSlug;
    const name = colon > 0 ? displayName.slice(colon + 1).trim() || displayName : displayName;

    const slug = `${labSlug}/${modelSlug}`;
    if (seenSlug.has(slug)) {
      out.issues.push({ modelId: id, field: 'slug', message: `duplicate slug ${slug}, row skipped` });
      continue;
    }
    seenSlug.add(slug);

    const contextWindow = tokenCount(raw.context_length);
    if (contextWindow === null) {
      out.issues.push({ modelId: id, field: 'context_length', message: 'no usable context_length, stored as 0' });
    }

    const caps = capabilitiesFrom(raw.supported_parameters);
    const inputModalities = (raw.architecture?.input_modalities ?? []).map((s) => String(s).toLowerCase());
    const outputModalities = (raw.architecture?.output_modalities ?? []).map((s) => String(s).toLowerCase());

    out.labs.set(labSlug, { slug: labSlug, name: labName || labSlug });
    out.models.push({
      slug,
      name,
      labSlug,
      labName: labName || labSlug,
      modelType: typeFrom(raw),
      contextWindow: contextWindow ?? 0,
      maxOutputTokens: tokenCount(raw.top_provider?.max_completion_tokens),
      inputModalities,
      outputModalities,
      supportsVisionInput: inputModalities.includes('image') || inputModalities.includes('video'),
      openWeights: Boolean(raw.hugging_face_id),
      description: raw.description ? String(raw.description).trim() : null,
      releaseDate: epochToIso(raw.created),
      deprecatedAt: raw.expiration_date ? safeIso(raw.expiration_date) : null,
      raw,
      ...caps,
    });

    // Listings: one row per served endpoint when we have them, else one from top_provider.
    const eps = endpoints.get(id);
    const drafts: Array<Omit<ListingRow, 'modelSlug' | 'providerSlug'>> = [];
    if (eps && eps.length > 0) {
      for (const e of eps) {
        drafts.push({
          providerName: e.provider_name || 'Unknown provider',
          endpointName: slugPart(e.name) || 'default',
          promptPer1M: perMillion(e.pricing?.prompt),
          completionPer1M: perMillion(e.pricing?.completion),
          cacheReadPer1M: perMillion(e.pricing?.input_cache_read),
          contextWindow: tokenCount(e.context_length),
          maxOutputTokens: tokenCount(e.max_completion_tokens),
          quantization: e.quantization ? String(e.quantization) : null,
          latencyP50Ms: roundOrNull(e.latency_last_30m),
          throughputTps: roundOrNull(e.throughput_last_30m),
          uptimePct: percentOrNull(e.uptime_last_1d),
          isFree: isZeroPrice(e.pricing),
          status: e.status ? String(e.status) : null,
        });
      }
    } else {
      drafts.push({
        providerName: raw.top_provider?.name || 'Unknown provider',
        endpointName: 'default',
        promptPer1M: perMillion(raw.pricing?.prompt),
        completionPer1M: perMillion(raw.pricing?.completion),
        cacheReadPer1M: perMillion(raw.pricing?.input_cache_read),
        contextWindow: tokenCount(raw.top_provider?.context_length) ?? contextWindow,
        maxOutputTokens: tokenCount(raw.top_provider?.max_completion_tokens),
        quantization: null,
        latencyP50Ms: null,
        throughputTps: null,
        uptimePct: null,
        isFree: isZeroPrice(raw.pricing),
        status: null,
      });
    }

    for (const d of drafts) {
      const providerSlug = slugPart(d.providerName);
      out.providers.set(providerSlug, { slug: providerSlug, name: d.providerName });
      out.listings.push({ ...d, modelSlug: slug, providerSlug });
    }

    for (const [field, score] of benchmarkEntries(raw.benchmarks)) {
      const meta = benchmarkMeta(field);
      out.benchmarks.set(meta.slug, meta);
      out.scores.push({ modelSlug: slug, benchmarkSlug: meta.slug, score, sourceUrl: null });
    }
  }

  return out;
}

function roundOrNull(value: number | null | undefined): number | null {
  const n = Number(value);
  return value == null || !Number.isFinite(n) ? null : Math.round(n);
}

/**
 * Upstream sends uptime already as a percentage (observed 99.4186046511628, 100, null), so this is
 * a rounding-and-clamp step, not a unit conversion. The column is Decimal(5,2), which tops out at
 * 999.99 — the first version of this function multiplied by 100 because the field name suggested a
 * 0..1 ratio, and the ingest died on `Out of range`. Clamping also means a source that starts
 * sending a ratio lands at 100.00 and looks like a full-uptime provider, which is wrong in a
 * *visible* way instead of a silent one.
 */
function percentOrNull(value: number | null | undefined): string | null {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n)).toFixed(2);
}


function isZeroPrice(pricing: RawPricing): boolean {
  return Number(pricing?.prompt ?? NaN) === 0 && Number(pricing?.completion ?? NaN) === 0;
}

function benchmarkEntries(benchmarks: Record<string, unknown> | null | undefined): Array<[string, string]> {
  const aa = (benchmarks as { artificial_analysis?: Record<string, unknown> } | null | undefined)?.artificial_analysis;
  if (!aa || typeof aa !== 'object') return [];
  const found: Array<[string, string]> = [];
  for (const [field, value] of Object.entries(aa)) {
    if (!(field in BENCHMARK_LABELS)) continue;
    const n = Number(value);
    if (value === null || value === '' || !Number.isFinite(n)) continue; // nulls are common: skip, don't zero
    found.push([field, n.toFixed(4)]);
  }
  return found;
}

/** aa_coding_index -> { slug: "aa_coding", name, category }. Unknown fields are dropped, not guessed. */
export function benchmarkMeta(field: string): BenchmarkRow & { field: string } {
  const meta = BENCHMARK_LABELS[field]!;
  return {
    field,
    slug: `aa_${field.replace(/_index$/, '')}`,
    name: meta.name,
    category: meta.category,
    unit: 'score',
  };
}
