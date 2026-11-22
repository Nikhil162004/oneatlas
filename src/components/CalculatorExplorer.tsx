'use client';

/**
 * The workload calculator: requests per day and tokens per request in, a ranked monthly bill
 * out. The per-model estimator on a model page answers "what does this model cost me"; this
 * answers the prior question, "which model should that be". Prices are the cheapest mirrored
 * per-1M rates the catalogue list carries, seeded by the server from the same service
 * /api/models reads, so the ranking here and the prices on /models cannot disagree. The
 * arithmetic is local: rates do not change while you type, so nothing is refetched.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ModelListItem } from '@/lib/present';
import { priceLabel } from '@/lib/format';

const money = (v: number) => (v >= 100 ? `$${v.toFixed(0)}` : v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`);

export default function CalculatorExplorer({ initialRows }: { initialRows: ModelListItem[] }) {
  const [requests, setRequests] = useState(1000);
  const [inTokens, setInTokens] = useState(2000);
  const [outTokens, setOutTokens] = useState(500);

  const ranked = useMemo(() => {
    const days = 30;
    return initialRows
      .filter((m) => m.pricing.per1M.prompt !== null && m.pricing.per1M.completion !== null)
      .map((m) => {
        const perRequest = (inTokens * (m.pricing.per1M.prompt ?? 0) + outTokens * (m.pricing.per1M.completion ?? 0)) / 1_000_000;
        return { m, perRequest, monthly: perRequest * requests * days };
      })
      .sort((a, b) => a.monthly - b.monthly)
      .slice(0, 25);
  }, [initialRows, requests, inTokens, outTokens]);

  const field = (label: string, value: number, set: (n: number) => void, hint: string) => (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="field mt-1 w-full"
        type="number"
        min={0}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))}
      />
      <span className="mt-1 block text-xs text-[var(--faint)]">{hint}</span>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="card grid gap-4 sm:grid-cols-3">
        {field('Requests per day', requests, setRequests, 'sustained average, not peak')}
        {field('Input tokens per request', inTokens, setInTokens, 'prompt, context and history')}
        {field('Output tokens per request', outTokens, setOutTokens, 'completion length')}
      </div>

      <p className="text-sm text-[var(--muted)]">
        Ranked among the <span className="num">{initialRows.length} cheapest-by-input models</span> mirrored, at each model's
        cheapest provider rate, over a 30-day month. Cached input, retries and provider minimums are not modelled; the
        per-model estimator on any model page re-prices its own providers.
      </p>

      <div className="tablewrap">
        <table className="stack-sm min-w-[800px] text-sm">
          <caption className="sr-only">Models ranked by estimated monthly cost for the workload above</caption>
          <thead>
            <tr>
              <th scope="col" className="text-right">Rank</th>
              <th scope="col">Model</th>
              <th scope="col">Lab</th>
              <th scope="col" className="text-right">In / out per 1M</th>
              <th scope="col" className="text-right">Per request</th>
              <th scope="col" className="text-right">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ m, perRequest, monthly }, i) => (
              <tr key={m.id}>
                <td className="num text-right">{i + 1}</td>
                <td data-title>
                  <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${m.slug}`}>{m.name}</Link>
                </td>
                <td>{m.lab.name}</td>
                <td className="num text-right">
                  {priceLabel(m.pricing.per1M.prompt)} / {priceLabel(m.pricing.per1M.completion)}
                </td>
                <td className="num text-right">{money(perRequest)}</td>
                <td className="num text-right">{money(monthly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
