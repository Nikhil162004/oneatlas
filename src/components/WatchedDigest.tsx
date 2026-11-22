'use client';

/**
 * The changes feed, personalised: only the models this browser watches. The watchlist lives in
 * localStorage (components/watchlist), so this filter is also local — the server feed stays
 * public and complete, and the digest is a view over it, not a second feed. Renders nothing
 * until the list is read, because "you watch nothing" and "not yet known" differ.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readWatchlist } from '@/components/watchlist';
import { fetchApi } from '@/components/live';

type Change = Awaited<ReturnType<typeof import('@/lib/services/catalogue').changesFeed>>['data'][number];

export default function WatchedDigest() {
  const [state, setState] = useState<{ watched: number; items: Change[] } | null>(null);

  useEffect(() => {
    const picks = readWatchlist();
    if (!picks.length) {
      setState({ watched: 0, items: [] });
      return;
    }
    const slugs = new Set(picks.map((p) => p.slug));
    fetchApi<Change[], unknown>('/api/changes?limit=100', new AbortController().signal)
      .then(({ data }) => setState({ watched: picks.length, items: data.filter((c) => slugs.has(c.modelSlug)).slice(0, 5) }))
      .catch(() => setState({ watched: picks.length, items: [] }));
  }, []);

  if (!state) return null;
  if (!state.watched) {
    return (
      <p className="card card-tight text-sm text-[var(--muted)]">
        You are not watching any models yet. <Link className="underline" href="/models">Watch one from the catalogue</Link>{' '}
        and its moves will be gathered here, separate from the full feed.
      </p>
    );
  }
  return (
    <section className="card card-tight">
      <p className="text-sm">
        <span className="font-medium">Your watched models</span>{' '}
        <span className="num text-[var(--faint)]">{state.watched} watched · {state.items.length} recent moves shown</span>
      </p>
      {state.items.length ? (
        <ul className="mt-2 space-y-1.5 text-sm">
          {state.items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="num text-xs text-[var(--faint)]">{new Date(c.at).toISOString().slice(0, 10)}</span>
              <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${c.modelSlug}`}>{c.modelSlug}</Link>
              <span className="text-[var(--muted)]">{c.field}</span>
              <span className="num text-[var(--muted)]">{c.oldValue ?? '—'} → {c.newValue ?? '—'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">No recorded changes for your watched models yet.</p>
      )}
    </section>
  );
}
