'use client';

/**
 * The model finder: three questions, then a hand-off. It invents no query language of its own —
 * the answers map onto the exact parameters /models (and GET /api/models) already speak, the
 * island counts the matches live from that API, and "Show matching models" navigates to the
 * filtered catalogue URL, so the result is a link like any other view. Guidance is a doorway
 * into the filter engine, not a second engine.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/components/live';

type Task = 'chat' | 'coding' | 'vision' | 'embeddings' | 'images';
type Budget = 'free' | 'cheap' | 'mid' | 'any';
type Context = 'any' | '32k' | '128k' | '1m';

function paramsFor(task: Task, budget: Budget, context: Context): URLSearchParams {
  const sp = new URLSearchParams();
  if (task === 'chat') sp.set('type', 'TEXT');
  if (task === 'coding') {
    sp.set('type', 'TEXT');
    sp.set('capabilities', 'tools');
  }
  if (task === 'vision') sp.set('capabilities', 'vision');
  if (task === 'embeddings') sp.set('type', 'EMBEDDING');
  if (task === 'images') sp.set('type', 'IMAGE');
  if (budget === 'free') sp.set('free', 'true');
  if (budget === 'cheap') sp.set('maxPrice', '0.1');
  if (budget === 'mid') sp.set('maxPrice', '1');
  if (context === '32k') sp.set('minContext', '32000');
  if (context === '128k') sp.set('minContext', '128000');
  if (context === '1m') sp.set('minContext', '1000000');
  sp.set('sort', 'priceLow');
  return sp;
}

const group = <T extends string>(legend: string, value: T, set: (v: T) => void, options: Array<[T, string]>) => (
  <fieldset className="card">
    <legend className="px-1 text-sm font-medium">{legend}</legend>
    <div className="mt-1 flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          className="chip"
          aria-pressed={value === v}
          data-active={value === v || undefined}
          style={value === v ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' } : undefined}
          onClick={() => set(v)}
        >
          {label}
        </button>
      ))}
    </div>
  </fieldset>
);

export default function FinderExplorer() {
  const router = useRouter();
  const [task, setTask] = useState<Task>('chat');
  const [budget, setBudget] = useState<Budget>('any');
  const [context, setContext] = useState<Context>('any');
  const [count, setCount] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const sp = paramsFor(task, budget, context);
        const { meta } = await fetchApi<unknown[], { total: number | null }>(`/api/models?${sp.toString()}&limit=1`, new AbortController().signal);
        setCount(meta.total);
      } catch {
        setCount(null);
      }
    }, 250);
  }, [task, budget, context]);

  const go = () => router.push(`/models?${paramsFor(task, budget, context).toString()}`);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {group<Task>('1. What should it do?', task, setTask, [
          ['chat', 'Chat and reasoning'],
          ['coding', 'Coding with tools'],
          ['vision', 'Understand images'],
          ['embeddings', 'Embeddings'],
          ['images', 'Generate images'],
        ])}
        {group<Budget>('2. What can it cost?', budget, setBudget, [
          ['free', 'Free only'],
          ['cheap', 'Under $0.10 / 1M in'],
          ['mid', 'Under $1 / 1M in'],
          ['any', 'Any price'],
        ])}
        {group<Context>('3. How much context?', context, setContext, [
          ['any', 'Any'],
          ['32k', '32k or more'],
          ['128k', '128k or more'],
          ['1m', '1M or more'],
        ])}
      </div>

      <div className="card flex flex-wrap items-center gap-4">
        <p className="num text-sm" aria-live="polite">
          {count === null ? 'Counting matches…' : `${count.toLocaleString('en-US')} models match`}
        </p>
        <button type="button" className="btn btn-primary" onClick={go} disabled={count === 0}>
          Show matching models
        </button>
        <p className="text-xs text-[var(--faint)]">
          Lands on the catalogue with these filters applied; refine or share the URL from there.
        </p>
      </div>
    </div>
  );
}
