import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelChanges, listingChanges, diffCatalogue, type ModelSnapshot, type ListingSnapshot } from '../src/lib/ingest/diff';

const model: ModelSnapshot = {
  slug: 'acme/turbo-1',
  contextWindow: 128000,
  maxOutputTokens: 4096,
  supportsReasoning: false,
  supportsToolCalling: true,
  supportsStructuredOutput: true,
  supportsVisionInput: false,
  openWeights: false,
  deprecatedAt: null,
};

const listing: ListingSnapshot = {
  modelSlug: 'acme/turbo-1',
  providerSlug: 'openrouter',
  endpointName: 'default',
  promptPer1M: '1.00',
  completionPer1M: '2.00',
};

test('an unchanged model produces no events', () => {
  assert.deepEqual(modelChanges(model, { ...model }), []);
});

test('a new model is one event, not one per field', () => {
  const events = modelChanges(undefined, model);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.field, 'model added');
});

test('spec and capability moves are reported field by field', () => {
  const events = modelChanges(model, { ...model, contextWindow: 256000, supportsReasoning: true, openWeights: true });
  assert.deepEqual(events.map((e) => e.field), ['context window', 'reasoning', 'open weights']);
  assert.deepEqual([events[0]!.oldValue, events[0]!.newValue], ['128000', '256000']);
});

test('deprecation and reinstatement are distinct events', () => {
  assert.equal(modelChanges(model, { ...model, deprecatedAt: '2026-01-01T00:00:00.000Z' })[0]!.field, 'deprecated');
  assert.equal(modelChanges({ ...model, deprecatedAt: '2026-01-01T00:00:00.000Z' }, model)[0]!.field, 'reinstated');
});

test('a re-priced listing reports both legs with provider detail', () => {
  const events = listingChanges(listing, { ...listing, promptPer1M: '1.50', completionPer1M: '1.75' });
  assert.deepEqual(events.map((e) => e.field), ['input price', 'output price']);
  assert.equal(events[0]!.detail, 'openrouter · default');
});

test('price formatting noise is not a change', () => {
  assert.deepEqual(listingChanges(listing, { ...listing, promptPer1M: '1.0', completionPer1M: '2.000' }), []);
});

test('a new listing is growth, not a change', () => {
  assert.deepEqual(listingChanges(undefined, listing), []);
});

test('diffCatalogue combines model and listing events', () => {
  const events = diffCatalogue(
    new Map([[model.slug, model]]),
    new Map([[`${listing.modelSlug}|${listing.providerSlug}|${listing.endpointName}`, listing]]),
    [{ ...model, maxOutputTokens: 8192 }],
    [{ ...listing, promptPer1M: '0.50' }],
  );
  assert.deepEqual(events.map((e) => e.field), ['max output', 'input price']);
});
