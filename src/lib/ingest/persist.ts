/**
 * Idempotent persistence for a normalised catalogue.
 *
 * Idempotent means: run it twice, the database looks the same. That is the property that makes an
 * ingest safe to re-run after a partial failure, so every write here is an upsert keyed on the
 * natural unique index (slug for labs/models/benchmarks, the (model, provider, endpoint) triple
 * for listings), and nothing here ever deletes. Deprecation is a column, not a delete — the live
 * product still lists deprecated models behind a "Hide deprecated" filter.
 *
 * shortcut: one upsert per row inside a batched transaction. At ~500 models that is a few seconds
 * and the readable code is worth more; past ~20k rows, rewrite as INSERT ... SELECT FROM unnest().
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import type { Normalised } from './normalise';

const BATCH = 200;
const chunk = <T>(items: T[], n = BATCH): T[][] => items.length ? Array.from({ length: Math.ceil(items.length / n) }, (_, i) => items.slice(i * n, (i + 1) * n)) : [];

export type PersistResult = { modelsUp: number; listingsUp: number; scoresUp: number; skipped: number };

export async function persistCatalogue(data: Normalised, source: string): Promise<PersistResult> {
  const run = await prisma.ingestRun.create({ data: { source, status: 'running' } });
  const result: PersistResult = { modelsUp: 0, listingsUp: 0, scoresUp: 0, skipped: data.issues.length };

  try {
    for (const part of chunk([...data.labs.values()])) {
      await prisma.$transaction(part.map((l) =>
        prisma.lab.upsert({ where: { slug: l.slug }, create: { slug: l.slug, name: l.name }, update: { name: l.name } }),
      ));
    }
    for (const part of chunk([...data.providers.values()])) {
      await prisma.$transaction(part.map((p) =>
        prisma.provider.upsert({ where: { slug: p.slug }, create: { slug: p.slug, name: p.name }, update: { name: p.name } }),
      ));
    }
    for (const part of chunk([...data.benchmarks.values()])) {
      await prisma.$transaction(part.map((b) =>
        prisma.benchmark.upsert({
          where: { slug: b.slug },
          create: { slug: b.slug, name: b.name, category: b.category, unit: b.unit },
          update: { name: b.name, category: b.category, unit: b.unit },
        }),
      ));
    }

    // Models need lab resolution first; we already upserted every lab in this run.
    const labs = await prisma.lab.findMany({ select: { id: true, slug: true } });
    const labId = new Map(labs.map((l) => [l.slug, l.id]));
    const providers = await prisma.provider.findMany({ select: { id: true, slug: true } });
    const providerId = new Map(providers.map((p) => [p.slug, p.id]));

    for (const part of chunk(data.models)) {
      await prisma.$transaction(part.map((m) => {
        const lab = labId.get(m.labSlug);
        if (!lab) throw new Error(`lab ${m.labSlug} missing after upsert (invariant broken)`);
        // Listed field by field, not spread from the row type: ModelRow also carries labSlug and
        // labName, which belong to Lab and are not columns here. A spread turns a rename in the
        // normaliser into 'Unknown argument' at 3am in an ingest run.
        const data = {
          slug: m.slug,
          name: m.name,
          modelType: m.modelType,
          contextWindow: m.contextWindow,
          maxOutputTokens: m.maxOutputTokens,
          inputModalities: m.inputModalities,
          outputModalities: m.outputModalities,
          supportsReasoning: m.supportsReasoning,
          supportsToolCalling: m.supportsToolCalling,
          supportsStructuredOutput: m.supportsStructuredOutput,
          supportsVisionInput: m.supportsVisionInput,
          openWeights: m.openWeights,
          description: m.description,
          releaseDate: m.releaseDate ? new Date(m.releaseDate) : null,
          deprecatedAt: m.deprecatedAt ? new Date(m.deprecatedAt) : null,
          raw: (m.raw ?? undefined) as Prisma.InputJsonValue,
          labId: lab,
        };
        return prisma.model.upsert({ where: { slug: m.slug }, create: data, update: data });
      }));
      result.modelsUp += part.length;
    }

    const models = await prisma.model.findMany({ where: { slug: { in: data.models.map((m) => m.slug) } }, select: { id: true, slug: true } });
    const modelId = new Map(models.map((m) => [m.slug, m.id]));

    for (const part of chunk(data.listings)) {
      await prisma.$transaction(part.flatMap((l) => {
        const mid = modelId.get(l.modelSlug);
        const pid = providerId.get(l.providerSlug);
        if (!mid || !pid) return []; // its model or provider was rejected upstream: skip, don't orphan
        const data = {
          endpointName: l.endpointName,
          promptPer1M: l.promptPer1M,
          completionPer1M: l.completionPer1M,
          cacheReadPer1M: l.cacheReadPer1M,
          contextWindow: l.contextWindow,
          maxOutputTokens: l.maxOutputTokens,
          quantization: l.quantization,
          latencyP50Ms: l.latencyP50Ms,
          throughputTps: l.throughputTps,
          uptimePct: l.uptimePct,
          isFree: l.isFree,
          status: l.status,
        };
        return [prisma.modelListing.upsert({
          where: { modelId_providerId_endpointName: { modelId: mid, providerId: pid, endpointName: l.endpointName } },
          create: { ...data, modelId: mid, providerId: pid },
          update: data,
        })];
      }));
      result.listingsUp += part.length;
    }

    // Scores reference Benchmark.id, and the normaliser emits the benchmark *slug*. Resolve it here
    // rather than passing a slug into an FK column and hoping the database agrees.
    const benchmarks = await prisma.benchmark.findMany({ select: { id: true, slug: true } });
    const benchmarkId = new Map(benchmarks.map((b) => [b.slug, b.id]));

    for (const part of chunk(data.scores)) {
      await prisma.$transaction(part.flatMap((s) => {
        const mid = modelId.get(s.modelSlug);
        const bid = benchmarkId.get(s.benchmarkSlug);
        if (!mid || !bid) return [];
        return [prisma.benchmarkScore.upsert({
          where: { benchmarkId_modelId: { benchmarkId: bid, modelId: mid } },
          create: { benchmarkId: bid, modelId: mid, score: s.score, sourceUrl: s.sourceUrl },
          update: { score: s.score, sourceUrl: s.sourceUrl },
        })];
      }));
      result.scoresUp += part.length;
    }

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { status: 'success', recordsIn: data.models.length + data.listings.length, modelsUp: result.modelsUp, listingsUp: result.listingsUp, skipped: result.skipped, finishedAt: new Date(), errors: (data.issues.slice(0, 200) as unknown) as Prisma.InputJsonValue },
    });
    return result;
  } catch (err) {
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { status: 'failed', finishedAt: new Date(), errors: { message: (err as Error).message } as unknown as Prisma.InputJsonValue },
    });
    throw err;
  }
}
