/**
 * Presentation contract, pinned. These four strings are the difference between a table that lies and
 * one that does not: `—` (not recorded), `Free` (recorded as zero) and `$0.00` must never collapse
 * into each other, and a column of prices has to line up on the decimal point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextLabel, msLabel, pctLabel, priceLabel, pricePair } from '../src/lib/format';

test('unknown price is an em dash, zero price is Free, and they are not each other', () => {
  assert.equal(priceLabel(null), '\u2014');
  assert.equal(priceLabel(undefined), '\u2014');
  assert.equal(priceLabel(Number.NaN), '\u2014');
  assert.equal(priceLabel(0), 'Free');
  assert.notEqual(priceLabel(0), priceLabel(null));
});

test('a price column keeps two decimals so the digits line up', () => {
  assert.equal(priceLabel(8), '$8.00');
  assert.equal(priceLabel(0.1), '$0.10');
  assert.equal(priceLabel(0.04), '$0.04');
  assert.equal(priceLabel(8), '$8.00');
  // Below a cent, two decimals would round a real price to $0.00, which is the same string a free
  // model would print if Free were not its own word. Precision follows the magnitude.
  assert.equal(priceLabel(0.005), '$0.005');
  assert.notEqual(priceLabel(0.005), '$0.00');
});

test('a pair only shows the side that exists', () => {
  assert.equal(pricePair(8, 40), '$8.00 / $40.00');
  assert.equal(pricePair(null, null), '\u2014');
  assert.equal(pricePair(0, 0), 'Free');
  assert.equal(pricePair(0.5, null), '$0.50 / \u2014');
});

test('context, latency and uptime keep their own units and their own unknown', () => {
  assert.equal(contextLabel(1_048_576), '1.05M');
  assert.equal(contextLabel(262_144), '262K');
  assert.equal(contextLabel(4096), '4.1K');
  assert.equal(contextLabel(128_000), '128K');
  assert.equal(contextLabel(32_768), '32.8K');
  assert.equal(contextLabel(0), '\u2014');
  assert.equal(contextLabel(null), '\u2014');
  assert.equal(msLabel(11), '11 ms');
  assert.equal(msLabel(null), '\u2014');
  assert.equal(pctLabel(99.4186), '99.42%');
  assert.equal(pctLabel(null), '\u2014');
});
