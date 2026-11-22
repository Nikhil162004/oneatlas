import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, perMillion, slugPart, tokenCount, benchmarkMeta, type RawModel } from '../src/lib/ingest/normalise';

const raw = (over: Partial<RawModel> = {}): RawModel => ({
  id: 'acme/widget-1',
  name: 'Acme: Widget 1',
  context_length: 131072,
  created: 1730000000,
  pricing: { prompt: '0.0000005', completion: '0.0000025' },
  architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  supported_parameters: ['tools', 'response_format', 'reasoning'],
  top_provider: { name: 'Acme API', context_length: 131072, max_completion_tokens: 8192 },
  ...over,
});

test('tokenCount reads the K/M suffixes the upstream API actually uses', () => {
  // Suffixes are decimal by choice: 128K is 128,000, not an assumed 131,072. See tokenCount.
  assert.equal(tokenCount('128K'), 128_000);
  assert.equal(tokenCount('1.05M'), 1_050_000);
  assert.equal(tokenCount('131072'.slice(0, 6)), 131072);
  assert.equal(tokenCount(131072), 131072);
  assert.equal(tokenCount('131072'), 131072);
  for (const bad of [null, undefined, '', '0', '-4', 'n/a', {} as never]) assert.equal(tokenCount(bad as never), null);
});

test('prices become USD per 1M tokens and stay exact strings', () => {
  assert.equal(perMillion('0.0000005'), '0.500000');
  assert.equal(perMillion(0.00000008), '0.080000');
  assert.equal(perMillion('0'), '0.000000');
  // unknown is unknown: not free, and not zero
  for (const bad of [null, undefined, '', 'abc', '-1']) assert.equal(perMillion(bad as never), null);
});

test('the lab half of the display name becomes the Lab, and the slug matches the URL', () => {
  const r = normalise([raw()]);
  const m = r.models[0]!;
  assert.equal(m.slug, 'acme/widget-1');
  assert.equal(m.name, 'Widget 1');
  assert.equal(m.labSlug, 'acme');
  assert.equal(m.labName, 'Acme');
  assert.deepEqual([...r.labs.values()], [{ slug: 'acme', name: 'Acme' }]);
});

test('capabilities come from supported_parameters, not from a name match', () => {
  const [m] = normalise([raw()]).models;
  assert.equal(m!.supportsToolCalling, true);
  assert.equal(m!.supportsStructuredOutput, true);
  assert.equal(m!.supportsReasoning, true);
  assert.equal(m!.supportsVisionInput, false);
  const [noCaps] = normalise([raw({ supported_parameters: [] })]).models;
  assert.equal(noCaps!.supportsToolCalling, false);
});

test('a vision model gets the vision flag from modalities', () => {
  const [m] = normalise([raw({ architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } })]).models;
  assert.equal(m!.supportsVisionInput, true);
});

test('model type follows output modality, with embed/rerank slugs winning', () => {
  assert.equal(normalise([raw({ id: 'acme/acme-embed-v2' })]).models[0]!.modelType, 'EMBEDDING');
  assert.equal(normalise([raw({ id: 'acme/rerank-lite' })]).models[0]!.modelType, 'RERANKING');
  assert.equal(normalise([raw({ architecture: { input_modalities: ['text'], output_modalities: ['image'] } })]).models[0]!.modelType, 'IMAGE');
  assert.equal(normalise([raw({ architecture: { input_modalities: ['audio'], output_modalities: ['text'] } })]).models[0]!.modelType, 'TRANSCRIPTION');
});

test('a free model is free; a model with no published price is not', () => {
  const free = normalise([raw({ pricing: { prompt: '0', completion: '0' }, top_provider: { name: 'Free Host' } })]);
  assert.equal(free.listings[0]!.isFree, true);
  const unknown = normalise([raw({ pricing: null, top_provider: { name: 'Nobody' } })]);
  assert.equal(unknown.listings[0]!.promptPer1M, null);
  assert.equal(unknown.listings[0]!.isFree, false);
});

test('one listing per endpoint, and provider identity is the pair, not the model', () => {
  const r = normalise([raw()], new Map([['acme/widget-1', [
    { name: 'standard', provider_name: 'Acme API', pricing: { prompt: '0.0000005', completion: '0.0000025' }, context_length: 131072, quantization: 'int4', uptime_last_1d: 0.9987, latency_last_30m: 812.6 },
    { name: 'fast', provider_name: 'Acme Fast', pricing: { prompt: '0.000001', completion: '0.000005' }, context_length: 65536, max_completion_tokens: 4096 },
  ]]]));
  assert.equal(r.listings.length, 2);
  assert.equal(r.listings[0]!.uptimePct, '99.87'); // ratio in, percentage out
  assert.equal(r.listings[0]!.latencyP50Ms, 813);
  assert.equal(r.listings[1]!.uptimePct, null);
  assert.equal(r.providers.size, 2);
  assert.equal(r.listings[0]!.modelSlug, 'acme/widget-1');
});

test('benchmark nulls are skipped instead of becoming a score of zero', () => {
  const r = normalise([raw({ benchmarks: { artificial_analysis: { intelligence_index: 34.6, coding_index: null, legal_index: 0 } } })]);
  const bySlug = new Map(r.scores.map((s) => [s.benchmarkSlug, s.score]));
  assert.equal(bySlug.get('aa_intelligence'), '34.6000');
  assert.equal(bySlug.has('aa_coding'), false);
  assert.equal(bySlug.get('aa_legal'), '0.0000'); // a real zero is not a gap
  assert.equal(benchmarkMeta('intelligence_index').slug, 'aa_intelligence');
});

test('bad rows are reported and skipped, never silently dropped', () => {
  const r = normalise([raw({ id: 'no-slash' }), raw({ id: 'acme/widget-1' }), raw({ id: 'acme/widget-1' })]);
  assert.equal(r.models.length, 1);
  assert.equal(r.issues.length, 2);
  assert.match(r.issues[0]!.message, /author\/slug/);
  assert.match(r.issues[1]!.message, /duplicate slug/);
});

test('slugPart canonicalises the case and spacing a human-typed source brings', () => {
  assert.equal(slugPart('Gemini 2.5 Pro'), 'gemini-2.5-pro');
  assert.equal(slugPart('  OpenAI '), 'openai');
  assert.equal(slugPart('GPT-4o 🚀'), 'gpt-4o');
  assert.equal(slugPart(''), '');
});
