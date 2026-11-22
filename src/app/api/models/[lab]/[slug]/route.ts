import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { badRequest, ok, route } from '@/lib/api';
import { slugParamSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/models/{lab}/{slug} — module 2: overview, specs, pricing, modalities, providers,
 * benchmarks. URL shape matches the live product, so a pasted link reads as the same site.
 */
export const GET = route(async function modelDetail(
  _request: Request,
  { params }: { params: Promise<{ lab: string; slug: string }> },
) {
  const parsed = slugParamSchema.safeParse(await params);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors, 'Invalid lab or slug');

  const full = `${parsed.data.lab.toLowerCase()}/${parsed.data.slug.toLowerCase()}`;
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
  if (!model) {
    return Response.json({ data: null, error: { code: 'not_found', message: `No model ${full}` } }, { status: 404 });
  }

  const money = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));
  return ok(
    {
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
        uptimePct: l.uptimePct === null ? null : Number(l.uptimePct),
        free: l.isFree,
        status: l.status,
      })),
      benchmarks: model.scores.map((s) => ({
        benchmark: s.benchmark,
        score: Number(s.score),
      })),
    },
    { etagSource: model.updatedAt.toISOString() },
  );
});
