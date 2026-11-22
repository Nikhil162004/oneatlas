'use client';

/**
 * "What will this actually cost me?" on a model page. Two token counts in, and every provider
 * serving the model is re-priced and re-ranked in place: cost = tokens x the per-1M rates the
 * providers table above already shows, so the estimate can never disagree with the listing it
 * came from. A provider with no rate for one side is shown unranked, not priced at zero: an
 * unknown price is not a free one (the same rule lib/present.ts enforces for the API).
 */
import { useState } from 'react';

export type CostListing = { provider: string; prompt: number | null; completion: number | null; free: boolean };

const money = (v: number) => (v === 0 ? '$0' : `$${v < 0.01 ? v.toFixed(5) : v < 1 ? v.toFixed(4) : v.toFixed(3)}`);

export default function CostEstimator({ listings }: { listings: CostListing[] }) {
  const [inputTokens, setInputTokens] = useState('1000000');
  const [outputTokens, setOutputTokens] = useState('100000');
  const inTok = Math.max(0, Number(inputTokens.replace(/[^0-9.]/g, '')) || 0);
  const outTok = Math.max(0, Number(outputTokens.replace(/[^0-9.]/g, '')) || 0);

  const rows = listings
    .map((l) => {
      const priced = l.prompt !== null && l.completion !== null;
      const input = priced ? (inTok / 1_000_000) * (l.prompt as number) : null;
      const output = priced ? (outTok / 1_000_000) * (l.completion as number) : null;
      return { ...l, input, output, total: input !== null && output !== null ? input + output : null };
    })
    .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity));

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label mb-1 block">Input tokens</span>
          <input className="field w-40 num" type="text" inputMode="numeric" value={inputTokens} onChange={(e) => setInputTokens(e.target.value)} aria-label="Input tokens" />
        </label>
        <label className="block">
          <span className="label mb-1 block">Output tokens</span>
          <input className="field w-40 num" type="text" inputMode="numeric" value={outputTokens} onChange={(e) => setOutputTokens(e.target.value)} aria-label="Output tokens" />
        </label>
        <span className="num pb-2 text-xs text-[var(--faint)]">re-prices as you type, cheapest first</span>
      </div>
      {rows.length ? (
        <div className="tablewrap mt-4">
          <table className="stack-sm min-w-[640px] text-sm">
            <caption className="sr-only">Estimated cost per provider for the token counts above</caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col" className="text-right">Input cost</th>
                <th scope="col" className="text-right">Output cost</th>
                <th scope="col" className="text-right">Estimated total</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={`${r.provider}-${i}`}>
                  <td data-title>
                    <span className="font-medium">{r.provider}</span>
                    {i === 0 && r.total !== null && <span className="flag mt-1 ml-1">cheapest</span>}
                    {r.free && <span className="flag flag-quiet mt-1 ml-1">free</span>}
                  </td>
                  <td data-label="Input cost" className="num text-right">{r.input !== null ? money(r.input) : '—'}</td>
                  <td data-label="Output cost" className="num text-right">{r.output !== null ? money(r.output) : '—'}</td>
                  <td data-label="Estimated total" className="num text-right font-medium">{r.total !== null ? money(r.total) : 'not priced'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="card card-tight mt-4 text-sm text-[var(--muted)]">
          No priced listing for this model, so there is nothing honest to estimate from.
        </p>
      )}
      {rows.length > 10 && <p className="num mt-2 text-xs text-[var(--faint)]">cheapest 10 of {rows.length} providers shown</p>}
    </div>
  );
}
