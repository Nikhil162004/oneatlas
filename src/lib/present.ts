/** Row shape returned by buildList's SQL, and the one mapping from it to JSON.
 * Lives apart from lib/api so the read services can import it without pulling in next/server. */

export type ListRow = {
  id: string;
  slug: string;
  name: string;
  modelType: string;
  contextWindow: number;
  maxOutputTokens: number | null;
  supportsReasoning: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVisionInput: boolean;
  openWeights: boolean;
  labSlug: string;
  labName: string;
  listings: number;
  providers: number;
  minPrompt: string | null;
  minCompletion: string | null;
  releaseDate: string | null;
  deprecatedAt: string | null;
  sortKey: string | null;
  total: number | null;
};

const num = (v: string | null) => (v === null || v === undefined || v === '' ? null : Number(v));

export function presentRow(r: ListRow) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    modelType: r.modelType,
    lab: { slug: r.labSlug, name: r.labName },
    contextWindow: r.contextWindow,
    maxOutputTokens: r.maxOutputTokens,
    capabilities: {
      reasoning: r.supportsReasoning,
      tools: r.supportsToolCalling,
      structuredOutput: r.supportsStructuredOutput,
      visionInput: r.supportsVisionInput,
      openWeights: r.openWeights,
    },
    // null, not 0: "we do not know this price" and "this is free" are different claims, and the
    // Free filter and the price sort both depend on the difference.
    pricing: { per1M: { prompt: num(r.minPrompt), completion: num(r.minCompletion) }, free: num(r.minPrompt) === 0 },
    // A count on the list, names on the detail page: see LISTING_AGGREGATE in lib/query.ts.
    providerCount: r.providers,
    listingCount: r.listings,
    releaseDate: r.releaseDate,
    deprecatedAt: r.deprecatedAt,
  };
}

export type ModelListItem = ReturnType<typeof presentRow>;
