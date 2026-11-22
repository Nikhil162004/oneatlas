/**
 * Read side of the product. Every route handler and every server component calls these, so a page
 * and its API can never disagree about what "sorted by cheapest provider" means.
 *
 * Nothing in here imports next/server: that is what lets `npm run dev` render a page without
 * round-tripping through its own HTTP surface (see services/stats.ts for why that matters).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { buildList, buildRanking, encodeCursor } from '../query';
import type { ListQuery } from '../validation';
import { presentRow, type ListRow } from '../present';

const money = (v: Prisma.Decimal | string | null) => (v === null || v === '' ? null : Number(String(v)));

/** Number formatting stays out of here: services return numbers, `lib/format` renders them. */

export async function listModels(input: ListQuery) {
  const { text, values } = buildList(input);
  const rows = (await prisma.$queryRawUnsafe(text, ...values)) as ListRow[];
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  const last = page[page.length - 1];

  return {
    data: page.map(presentRow),
    meta: {
      // Page 1 only: the count describes the filtered set, not the remainder after a cursor.
      total: page[0]?.total ?? (input.cursor ? null : 0),
      limit: input.limit,
      sort: input.sort,
      dir: input.dir ?? undefined,
      nextCursor: hasMore && last ? encodeCursor(last.sortKey, last.id) : null,
    },
  };
}

export async function modelDetail(lab: string, slug: string) {
  const full = `${lab.toLowerCase()}/${slug.toLowerCase()}`;
  const model = await prisma.model.findUnique({
    where: { slug: full },
    include: {
      lab: { select: { slug: true, name: true, website: true, summary: true } },
      listings: {
        orderBy: { promptPer1M: 'asc' },
        include: { provider: { select: { slug: true, name: true, website: true } } },
      },
      scores: { include: { benchmark: { select: { slug: true, name: true, category: true, unit: true } } } },
    },
  });
  if (!model) return null;

  return {
    id: model.id,
    slug: model.slug,
    name: model.name,
    description: model.description,
    modelType: model.modelType,
    contextWindow: model.contextWindow,
    maxOutputTokens: model.maxOutputTokens,
    inputModalities: model.inputModalities,
    outputModalities: model.outputModalities,
    capabilities: {
      reasoning: model.supportsReasoning,
      tools: model.supportsToolCalling,
      structuredOutput: model.supportsStructuredOutput,
      visionInput: model.supportsVisionInput,
      openWeights: model.openWeights,
    },
    releaseDate: model.releaseDate,
    deprecatedAt: model.deprecatedAt,
    lab: model.lab,
    updatedAt: model.updatedAt,
    // One entry per provider that serves this model: this is what "available providers" means.
    providers: model.listings.map((l) => ({
      provider: l.provider,
      endpoint: l.endpointName,
      per1M: { prompt: money(l.promptPer1M), completion: money(l.completionPer1M), cacheRead: money(l.cacheReadPer1M) },
      contextWindow: l.contextWindow,
      maxOutputTokens: l.maxOutputTokens,
      quantization: l.quantization,
      latencyP50Ms: l.latencyP50Ms,
      throughputTps: l.throughputTps,
      uptimePct: money(l.uptimePct),
      free: l.isFree,
      status: l.status,
      // The page splits these: a catalogue-level price is shown as the listing price, not as an
      // offer from a provider. Provenance is stored, not inferred from empty columns.
      fromEndpoint: l.source === 'ENDPOINT',
    })),
    benchmarks: model.scores.map((s) => ({ benchmark: s.benchmark, score: Number(s.score) })),
  };
}

export type CompareModel = NonNullable<Awaited<ReturnType<typeof modelDetail>>>;

export async function compareModels(slugs: string[]) {
  const wanted = slugs.map((s) => s.toLowerCase());
  const models = await prisma.model.findMany({
    where: { slug: { in: wanted } },
    include: {
      lab: { select: { slug: true, name: true } },
      listings: { include: { provider: { select: { slug: true, name: true } } }, orderBy: { promptPer1M: 'asc' } },
      scores: { include: { benchmark: { select: { slug: true, name: true, category: true } } } },
    },
    orderBy: { releaseDate: 'desc' },
  });
  const bySlug = new Map(models.map((m) => [m.slug, m]));

  return {
    // `selected` keeps the caller's order and marks what could not be loaded, so the page can say
    // "2 of 3 loaded" instead of silently shrinking the table.
    selected: slugs.map((slug) => ({ slug, found: bySlug.has(slug.toLowerCase()) })),
    rows: models.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      lab: m.lab,
      modelType: m.modelType,
      contextWindow: m.contextWindow,
      maxOutputTokens: m.maxOutputTokens,
      capabilities: {
        reasoning: m.supportsReasoning,
        tools: m.supportsToolCalling,
        structuredOutput: m.supportsStructuredOutput,
        visionInput: m.supportsVisionInput,
        openWeights: m.openWeights,
      },
      releaseDate: m.releaseDate,
      providers: m.listings.map((l) => ({
        provider: l.provider.name,
        providerSlug: l.provider.slug,
        free: l.isFree,
        per1M: { prompt: money(l.promptPer1M), completion: money(l.completionPer1M) },
      })),
      cheapest: { prompt: money(m.listings[0]?.promptPer1M ?? null), completion: money(m.listings[0]?.completionPer1M ?? null) },
      benchmarks: Object.fromEntries(m.scores.map((s) => [s.benchmark.slug, { score: Number(s.score), name: s.benchmark.name, category: s.benchmark.category }])),
    })),
  };
}

type RankRow = {
  benchmarkSlug: string;
  benchmarkName: string;
  category: string;
  score: string;
  id: string;
  slug: string;
  name: string;
  modelType: string;
  contextWindow: number;
  labSlug: string;
  labName: string;
  minPrompt: string | null;
  total: number | null;
};

export async function rankings(input: {
  benchmark?: string;
  category?: string;
  type?: string;
  minContext?: number;
  limit: number;
  offset: number;
}) {
  const { text, values } = buildRanking(input);
  // Typed because `buildRanking` returns raw SQL: without this every field is `unknown` and the
  // page has to cast, which hides a renamed column instead of failing here.
  const rows = (await prisma.$queryRawUnsafe(text, ...values)) as RankRow[];
  const benchmarks = await prisma.benchmark.findMany({
    select: { slug: true, name: true, category: true, unit: true, _count: { select: { scores: true } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return {
    data: rows.map((r, i) => ({
      rank: input.offset + i + 1,
      benchmark: { slug: r.benchmarkSlug, name: r.benchmarkName, category: r.category },
      score: Number(r.score),
      model: {
        id: r.id,
        slug: r.slug,
        name: r.name,
        modelType: r.modelType,
        contextWindow: r.contextWindow,
        lab: { slug: r.labSlug, name: r.labName },
      },
      cheapestPromptPer1M: r.minPrompt === null ? null : Number(r.minPrompt),
    })),
    meta: {
      total: Number(rows[0]?.total ?? 0),
      limit: input.limit,
      offset: input.offset,
      benchmarks: benchmarks.map((b) => ({ slug: b.slug, name: b.name, category: b.category, unit: b.unit, scored: b._count.scores })),
    },
  };
}

/** Directory: labs by how much they ship. Used by /labs and by the lab filter's <select>. */
export async function listLabs(limit = 100) {
  const data = await prisma.lab.findMany({
    take: Math.min(Math.max(limit, 1), 200),
    orderBy: [{ models: { _count: 'desc' } }, { name: 'asc' }],
    select: { slug: true, name: true, website: true, summary: true, _count: { select: { models: true } } },
  });
  return {
    data: data.map((l) => ({ slug: l.slug, name: l.name, website: l.website, summary: l.summary, modelCount: l._count.models })),
    meta: { limit, total: data.length },
  };
}

/**
 * One lab: their models plus the release cadence the brief asks for. There is no Release table —
 * a model row already *is* a release (docs/decisions/0004), so the timeline groups on releaseDate.
 */
export async function labDetail(slug: string) {
  const lab = await prisma.lab.findUnique({
    where: { slug: slug.toLowerCase() },
    include: {
      models: {
        orderBy: { releaseDate: 'desc' },
        select: {
          slug: true, name: true, modelType: true, contextWindow: true, releaseDate: true, deprecatedAt: true,
          openWeights: true, supportsReasoning: true, supportsToolCalling: true,
          listings: { take: 1, orderBy: { promptPer1M: 'asc' }, select: { promptPer1M: true, completionPer1M: true, provider: { select: { name: true } } } },
        },
      },
    },
  });
  if (!lab) return null;

  const releases = new Map<string, number>();
  for (const m of lab.models) {
    if (!m.releaseDate) continue;
    const key = m.releaseDate.toISOString().slice(0, 7);
    releases.set(key, (releases.get(key) ?? 0) + 1);
  }

  return {
    slug: lab.slug,
    name: lab.name,
    website: lab.website,
    summary: lab.summary,
    modelCount: lab.models.length,
    models: lab.models.map((m) => ({
      slug: m.slug,
      name: m.name,
      modelType: m.modelType,
      contextWindow: m.contextWindow,
      releaseDate: m.releaseDate,
      deprecated: Boolean(m.deprecatedAt),
      openWeights: m.openWeights,
      reasoning: m.supportsReasoning,
      tools: m.supportsToolCalling,
      cheapestPer1M: money(m.listings[0]?.promptPer1M ?? null),
      cheapestProvider: m.listings[0]?.provider.name ?? null,
    })),
    releases: [...releases.entries()].map(([month, count]) => ({ month, count })).sort((a, b) => b.month.localeCompare(a.month)),
  };
}

export async function listProviders(limit = 100) {
  // Endpoint-backed listings only. A model whose price came from its own catalogue entry is not a
  // provider serving anything, and leaving those in made "Unknown provider" the largest row in the
  // directory and dragged every average uptime to 0 (no measurement, not a bad one).
  const endpointOnly = { source: 'ENDPOINT' as const };
  const [rows, catalogueOnly] = await Promise.all([
    prisma.provider.findMany({
      where: { listings: { some: endpointOnly } },
      take: Math.min(Math.max(limit, 1), 200),
      orderBy: [{ listings: { _count: 'desc' } }, { name: 'asc' }],
      select: {
        slug: true, name: true, website: true,
        listings: {
          where: endpointOnly,
          select: { modelId: true, promptPer1M: true, isFree: true, uptimePct: true, latencyP50Ms: true },
        },
      },
    }),
    prisma.modelListing.count({ where: { source: 'CATALOGUE' } }),
  ]);

  // Number(null) is 0 and 0 is finite, so a null has to be dropped before the cast or an average
  // silently becomes a measurement of zero. That is the one mistake this app's own invariant names.
  const vals = <T,>(xs: Array<T | null>, to: (v: T) => number) =>
    xs.flatMap((v) => (v === null ? [] : [to(v)])).filter(Number.isFinite);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1e4) / 1e4 : null);
  const countOf = <T,>(xs: Array<T | null>, to: (v: T) => number) => { const v = vals(xs, to); return { list: v, n: v.length }; };

  return {
    data: rows.map((p) => {
      const prices = vals(p.listings.map((l) => l.promptPer1M), (v) => Number(v));
      const latencies = countOf(p.listings.map((l) => l.latencyP50Ms), (v) => v);
      const uptimes = countOf(p.listings.map((l) => l.uptimePct), (v) => Number(v));
      const uptimeList = uptimes.list.map((u) => Number(u));
      return {
        slug: p.slug,
        name: p.name,
        website: p.website,
        modelCount: new Set(p.listings.map((l) => l.modelId)).size,
        listingCount: p.listings.length,
        freeCount: p.listings.filter((l) => l.isFree).length,
        cheapestPromptPer1M: prices.length ? Math.min(...prices) : null,
        dearestPromptPer1M: prices.length ? Math.max(...prices) : null,
        avgPromptPer1M: avg(prices),
        avgLatencyMs: avg(latencies.list),
        latencySamples: latencies.n,
        avgUptimePct: avg(uptimeList),
        uptimeSamples: uptimes.n,
      };
    }),
    meta: { limit, endpointBacked: true, catalogueOnlyListings: catalogueOnly },
  };
}

/** Global search (module 6). Three bounded ILIKE reads rather than one UNION: different shapes,
 * rendered as groups anyway, and perGroup stops a single letter pulling the whole catalogue. */
export async function globalSearch(q: string, perGroup: number) {
  const term = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const like = { mode: 'insensitive' as const };
  const [models, labs, providers] = await Promise.all([
    prisma.model.findMany({
      where: { OR: [{ name: { contains: term, ...like } }, { slug: { contains: term, ...like } }] },
      take: perGroup,
      select: { slug: true, name: true, modelType: true, lab: { select: { name: true } } },
    }),
    prisma.lab.findMany({
      where: { OR: [{ name: { contains: term, ...like } }, { slug: { contains: term, ...like } }] },
      take: perGroup,
      select: { slug: true, name: true, _count: { select: { models: true } } },
    }),
    prisma.provider.findMany({
      where: { OR: [{ name: { contains: term, ...like } }, { slug: { contains: term, ...like } }] },
      take: perGroup,
      select: { slug: true, name: true, _count: { select: { listings: true } } },
    }),
  ]);

  const data = {
    models: models.map((m) => ({ type: 'model' as const, ...m })),
    labs: labs.map((l) => ({ type: 'lab' as const, ...l, modelCount: l._count.models })),
    providers: providers.map((p) => ({ type: 'provider' as const, ...p, listingCount: p._count.listings })),
  };
  return { data, meta: { query: q, empty: data.models.length + data.labs.length + data.providers.length === 0 } };
}
