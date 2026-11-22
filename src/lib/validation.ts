import { z } from 'zod';

/** Trust boundary: every value that arrives from a URL or a source payload passes through here. */

export const CAPABILITIES = ['reasoning', 'tools', 'structured', 'vision', 'openWeights'] as const;
export const SORT_KEYS = ['released', 'context', 'priceLow', 'priceHigh', 'name'] as const;
export const MODEL_TYPES = ['TEXT', 'IMAGE', 'EMBEDDING', 'VIDEO', 'SPEECH', 'TRANSCRIPTION', 'RERANKING', 'REALTIME'] as const;

// A GET form submits `<input type=checkbox name=free value=true>` only when checked, and submits
// `q=` (empty) for a text box the user left alone. parseQuery drops empty values, so this only has
// to understand real ones.
const boolFlag = z.preprocess(
  (v) => (v === 'true' || v === '1' || v === 'on' ? true : v === 'false' || v === '0' || v === 'off' ? false : v),
  z.boolean().optional(),
);

export const listQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  lab: z.string().trim().max(120).optional(),
  provider: z.string().trim().max(120).optional(),
  type: z.enum(MODEL_TYPES).optional(),
  capabilities: z
    .string()
    .max(200)
    .optional()
    .transform((s) => (s ? s.split(',').map((c) => c.trim()).filter((c): c is (typeof CAPABILITIES)[number] => CAPABILITIES.includes(c as never)) : undefined)),
  minContext: z.coerce.number().int().nonnegative().max(1_000_000_000).optional(),
  maxPrice: z.coerce.number().nonnegative().max(100_000).optional(),
  free: boolFlag,
  hideDeprecated: boolFlag,
  sort: z.enum(SORT_KEYS).default('released'),
  dir: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(500).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export const compareSchema = z.object({
  modelIds: z.array(z.string().trim().min(1).max(200)).min(2, 'pick at least 2 models').max(6, 'pick at most 6 models'),
});

/** /api/models/{lab}/{slug} — rejects anything that could become a path fragment. */
export const slugParamSchema = z.object({
  lab: z.string().regex(/^[a-z0-9.-]{1,120}$/i),
  slug: z.string().regex(/^[a-z0-9.-]{1,200}$/i),
});

export const rankingQuerySchema = z.object({
  view: z.enum(['score', 'value']).optional(),
  benchmark: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  type: z.enum(MODEL_TYPES).optional(),
  minContext: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});

export const globalSearchSchema = z.object({
  q: z.string().trim().min(1, 'q is required').max(200),
  perGroup: z.coerce.number().int().min(1).max(10).default(5),
});

/**
 * Upstream catalogue shape. Deliberately loose on the fields we merely pass through and strict on
 * the ones we compute from, so a source rename fails loudly at the place it matters.
 */
export const rawModelSchema = z
  .object({
    id: z.string().min(3),
    name: z.string().nullish(),
    description: z.string().nullish(),
    created: z.number().nullish(),
    expiration_date: z.string().nullish(),
    context_length: z.union([z.number(), z.string()]).nullish(),
    pricing: z.object({ prompt: z.union([z.string(), z.number()]).nullish(), completion: z.union([z.string(), z.number()]).nullish(), input_cache_read: z.union([z.string(), z.number()]).nullish() }).nullish(),
    architecture: z.object({ input_modalities: z.array(z.string()).nullish(), output_modalities: z.array(z.string()).nullish() }).nullish(),
    supported_parameters: z.array(z.string()).nullish(),
    top_provider: z.object({ name: z.string().nullish(), context_length: z.union([z.number(), z.string()]).nullish(), max_completion_tokens: z.union([z.number(), z.string()]).nullish() }).nullish(),
    hugging_face_id: z.string().nullish(),
    benchmarks: z.record(z.unknown()).nullish(),
  })
  .passthrough();

export const rawModelListSchema = z.object({ data: z.array(rawModelSchema).min(1, 'empty catalogue') }).or(z.array(rawModelSchema));

export const rawEndpointListSchema = z
  .object({
    data: z
      .object({
        endpoints: z
          .array(
            z
              .object({
                name: z.string().nullish(),
                provider_name: z.string().nullish(),
                context_length: z.union([z.number(), z.string()]).nullish(),
                max_completion_tokens: z.union([z.number(), z.string()]).nullish(),
                quantization: z.string().nullish(),
                // Upstream sends an integer code here, not a word. Declaring it a string made
                // every enriched model fail validation and get skipped — see docs/review-log.md.
                status: z.union([z.string(), z.number()]).nullish(),
                uptime_last_1d: z.number().nullish(),
                latency_last_30m: z.number().nullish(),
                throughput_last_30m: z.number().nullish(),
                supported_parameters: z.array(z.string()).nullish(),
                pricing: z.object({ prompt: z.union([z.string(), z.number()]).nullish(), completion: z.union([z.string(), z.number()]).nullish(), input_cache_read: z.union([z.string(), z.number()]).nullish() }).nullish(),
              })
              .passthrough(),
          )
          .nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

/** Query params -> validated object, or a flat field map the route turns into a 400. */
export function parseQuery<T extends z.ZodTypeAny>(schema: T, searchParams: URLSearchParams) {
  const raw: Record<string, string> = {};
  // Empty strings from an untouched form field are "not set", not a value to validate: keeping
  // them would turn a first search into a 400 (min(1) on q, nonnegative on minContext).
  for (const [k, v] of searchParams.entries()) if (v !== '') raw[k] = v;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, fields: parsed.error.flatten().fieldErrors };
  }
  return { ok: true as const, data: parsed.data as z.infer<T> };
}
