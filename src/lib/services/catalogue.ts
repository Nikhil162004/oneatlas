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
import { pctChange } from '../ingest/diff';

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

/**
 * Alternatives to one model: same type first, shared capabilities next, then cheapest, so the
 * list reads as "the same job, other trade-offs" rather than a random sample of the catalogue.
 * Overlap is counted over the five capability flags both models carry; price is each model's
 * cheapest listing from any provider, the number the rest of the app already ranks by.
 */
export async function similarModels(lab: string, slug: string, limit = 6) {
  const target = await modelDetail(lab, slug);
  if (!target) return null;
  const flags = ['reasoning', 'tools', 'structuredOutput', 'visionInput', 'openWeights'] as const;
  const wanted = flags.filter((f) => target.capabilities[f]);

  const candidates = await prisma.model.findMany({
    where: { modelType: target.modelType, slug: { not: target.slug } },
    take: 120,
    orderBy: { releaseDate: 'desc' },
    select: {
      slug: true, name: true, modelType: true, contextWindow: true,
      supportsReasoning: true, supportsToolCalling: true, supportsStructuredOutput: true,
      supportsVisionInput: true, openWeights: true,
      lab: { select: { name: true } },
      listings: { take: 1, orderBy: { promptPer1M: 'asc' }, select: { promptPer1M: true } },
      _count: { select: { listings: true } },
    },
  });

  const capsOf = (m: (typeof candidates)[number]) => ({
    reasoning: m.supportsReasoning, tools: m.supportsToolCalling, structuredOutput: m.supportsStructuredOutput,
    visionInput: m.supportsVisionInput, openWeights: m.openWeights,
  });

  return {
    target: { slug: target.slug, name: target.name },
    data: candidates
      .map((m) => {
        const caps = capsOf(m);
        return {
          slug: m.slug, name: m.name, modelType: m.modelType, lab: m.lab,
          contextWindow: m.contextWindow, capabilities: caps,
          sharedCapabilities: wanted.filter((f) => caps[f]).length,
          cheapestPromptPer1M: money(m.listings[0]?.promptPer1M ?? null),
          providerCount: m._count.listings,
        };
      })
      .sort((a, b) =>
        b.sharedCapabilities - a.sharedCapabilities ||
        (a.cheapestPromptPer1M ?? Infinity) - (b.cheapestPromptPer1M ?? Infinity))
      .slice(0, limit),
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
  value: string | null;
  total: number | null;
};

export async function rankings(input: {
  benchmark?: string;
  category?: string;
  type?: string;
  minContext?: number;
  view?: string;
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
      value: r.value === null ? null : Number(r.value),
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

/**
 * One provider: the models it actually serves (endpoint-backed listings only, the same rule the
 * directory applies), with this provider's own cheapest price on each. The directory answers
 * "who is out there"; this answers "what would I get from this one", which is the question the
 * brief's "discover providers and their supported models" is asking.
 */
export async function providerDetail(slug: string) {
  const provider = await prisma.provider.findUnique({
    where: { slug: slug.toLowerCase() },
    select: {
      slug: true,
      name: true,
      website: true,
      listings: {
        where: { source: 'ENDPOINT' },
        orderBy: { promptPer1M: 'asc' },
        select: {
          promptPer1M: true, completionPer1M: true, isFree: true, latencyP50Ms: true, uptimePct: true,
          model: {
            select: {
              slug: true, name: true, modelType: true, contextWindow: true, releaseDate: true,
              lab: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!provider || !provider.listings.length) return null;

  const vals = <T,>(xs: Array<T | null>, to: (v: T) => number) =>
    xs.flatMap((v) => (v === null ? [] : [to(v)])).filter(Number.isFinite);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1e4) / 1e4 : null);

  // Cheapest listing per model from this provider: listings arrive price-ordered, so the first
  // sighting of a model is its floor here.
  const byModel = new Map<string, (typeof provider.listings)[number]>();
  for (const l of provider.listings) if (!byModel.has(l.model.slug)) byModel.set(l.model.slug, l);
  const prices = vals(provider.listings.map((l) => l.promptPer1M), (v) => Number(v));
  const latencies = vals(provider.listings.map((l) => l.latencyP50Ms), (v) => v);
  const uptimes = vals(provider.listings.map((l) => l.uptimePct), (v) => Number(v));

  return {
    slug: provider.slug,
    name: provider.name,
    website: provider.website,
    modelCount: byModel.size,
    listingCount: provider.listings.length,
    freeCount: provider.listings.filter((l) => l.isFree).length,
    cheapestPromptPer1M: prices.length ? Math.min(...prices) : null,
    avgPromptPer1M: avg(prices),
    dearestPromptPer1M: prices.length ? Math.max(...prices) : null,
    avgLatencyMs: avg(latencies),
    latencySamples: latencies.length,
    avgUptimePct: avg(uptimes),
    uptimeSamples: uptimes.length,
    models: [...byModel.values()]
      .map((l) => ({
        slug: l.model.slug,
        name: l.model.name,
        modelType: l.model.modelType,
        lab: l.model.lab.name,
        contextWindow: l.model.contextWindow,
        releaseDate: l.model.releaseDate,
        per1M: { prompt: money(l.promptPer1M), completion: money(l.completionPer1M) },
        latencyP50Ms: l.latencyP50Ms,
        uptimePct: money(l.uptimePct),
        free: l.isFree,
      }))
      .sort((a, b) => (a.per1M.prompt ?? Infinity) - (b.per1M.prompt ?? Infinity) || a.name.localeCompare(b.name)),
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

/** The change feed (Batch C). Events were written by the ingest that caused them, so this is a
 * plain read: newest first, bounded, with the run's source attached so a reader can tell a
 * scheduled mirror from a manual one. */
export async function changesFeed(limit = 50) {
  const [rows, total] = await Promise.all([
    prisma.changeEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { run: { select: { source: true, startedAt: true } } },
    }),
    prisma.changeEvent.count(),
  ]);
  return {
    data: rows.map((r) => ({
      id: r.id,
      modelSlug: r.modelSlug,
      field: r.field,
      detail: r.detail,
      oldValue: r.oldValue,
      newValue: r.newValue,
      at: r.createdAt.toISOString(),
      source: r.run.source,
      pctChange: pctChange(r.field, r.oldValue, r.newValue),
    })),
    meta: { limit, total },
  };
}

export type HistoryEvent = Awaited<ReturnType<typeof changesFeed>>['data'][number];

/** One model's recorded past: the same events the feed shows, filtered to a slug and read
 * newest first. The model page renders this as its History section, so a price on the page can
 * be checked against every move that produced it. */
export async function modelHistory(lab: string, slug: string, limit = 50) {
  const full = `${lab.toLowerCase()}/${slug.toLowerCase()}`;
  const rows = await prisma.changeEvent.findMany({
    where: { modelSlug: full },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { run: { select: { source: true } } },
  });
  return {
    data: rows.map((r) => ({
      id: r.id,
      modelSlug: r.modelSlug,
      field: r.field,
      detail: r.detail,
      oldValue: r.oldValue,
      newValue: r.newValue,
      at: r.createdAt.toISOString(),
      source: r.run.source,
      pctChange: pctChange(r.field, r.oldValue, r.newValue),
    })),
    meta: { limit, slug: full },
  };
}

/** Ingest health: the runs themselves are the audit log IngestRun was created for. The status
 * view answers "is the daily mirror alive, and when did it last succeed" without a database
 * console; it reads the same rows the cron writes. */
export async function ingestStatus() {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [runs, models, listings, changesTotal, changes7d] = await Promise.all([
    prisma.ingestRun.findMany({ orderBy: { startedAt: 'desc' }, take: 12, include: { _count: { select: { changes: true } } } }),
    prisma.model.count(),
    prisma.modelListing.count(),
    prisma.changeEvent.count(),
    prisma.changeEvent.count({ where: { createdAt: { gte: since } } }),
  ]);
  const lastSuccess = runs.find((r) => r.status === 'success');
  return {
    data: {
      counts: { models, listings, changes: changesTotal, changesLast7d: changes7d },
      lastSuccessAt: lastSuccess?.finishedAt?.toISOString() ?? null,
      schedule: 'daily 03:00 UTC (Vercel Cron → /api/cron/ingest)',
      runs: runs.map((r) => ({
        id: r.id,
        source: r.source,
        status: r.status,
        modelsUp: r.modelsUp,
        listingsUp: r.listingsUp,
        skipped: r.skipped,
        changes: r._count.changes,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        durationMs: r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null,
      })),
    },
    meta: {},
  };
}

/** Benchmarks as subjects, not just filters: every benchmark with how many models it has scored
 * and who currently tops it. Higher-is-better is a column, not an assumption, so the top row is
 * read in the direction the benchmark defines. */
export async function listBenchmarks() {
  const rows = await prisma.benchmark.findMany({ orderBy: { name: 'asc' } });
  const data = await Promise.all(
    rows.map(async (b) => {
      const [count, top] = await Promise.all([
        prisma.benchmarkScore.count({ where: { benchmarkId: b.id } }),
        prisma.benchmarkScore.findFirst({
          where: { benchmarkId: b.id },
          orderBy: { score: b.higherIsBetter ? 'desc' : 'asc' },
          include: { model: { select: { slug: true, name: true } } },
        }),
      ]);
      return {
        slug: b.slug,
        name: b.name,
        category: b.category,
        unit: b.unit,
        higherIsBetter: b.higherIsBetter,
        scoredModels: count,
        top: top ? { score: Number(top.score), modelSlug: top.model.slug, modelName: top.model.name } : null,
      };
    }),
  );
  return { data, meta: { total: data.length } };
}

/** One benchmark: what it measures and every scored model in the benchmark's own direction. */
export async function benchmarkDetail(slug: string) {
  const b = await prisma.benchmark.findUnique({ where: { slug: slug.toLowerCase() } });
  if (!b) return null;
  const scores = await prisma.benchmarkScore.findMany({
    where: { benchmarkId: b.id },
    orderBy: { score: b.higherIsBetter ? 'desc' : 'asc' },
    include: {
      model: {
        select: {
          slug: true, name: true, modelType: true, contextWindow: true,
          lab: { select: { slug: true, name: true } },
        },
      },
    },
  });
  return {
    slug: b.slug,
    name: b.name,
    category: b.category,
    unit: b.unit,
    higherIsBetter: b.higherIsBetter,
    scores: scores.map((s, i) => ({
      rank: i + 1,
      score: Number(s.score),
      sourceUrl: s.sourceUrl,
      model: s.model,
    })),
  };
}
