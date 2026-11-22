'use client';

/**
 * The watchlist: models a reader is tracking, kept to slugs in localStorage exactly like the
 * compare tray (components/tray.tsx) — no account, no server-side profile, and the list dies
 * with the browser rather than becoming data the product holds about a person. Prices and
 * changes are never stored here; /watchlist resolves the slugs through
 * GET /api/models/watchlist at read time, so what it shows is the mirror's current truth.
 */
import { useCallback, useEffect, useState } from 'react';

export type WatchPick = { slug: string; name: string };

const KEY = 'oneatlas:watchlist';
const EVENT = 'oneatlas:watchlist-changed';

export function readWatchlist(): WatchPick[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as WatchPick[];
    return Array.isArray(raw) ? raw.filter((p) => p && typeof p.slug === 'string').slice(0, 50) : [];
  } catch {
    return [];
  }
}

function writeWatchlist(picks: WatchPick[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(picks.slice(0, 50)));
  } catch {
    // Private mode: the watchlist becomes session-only, which is a degradation, not an error.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useWatchlist() {
  const [picks, setPicks] = useState<WatchPick[]>([]);
  const sync = useCallback(() => setPicks(readWatchlist()), []);
  useEffect(() => {
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  const toggle = useCallback((pick: WatchPick) => {
    const current = readWatchlist();
    writeWatchlist(current.some((p) => p.slug === pick.slug) ? current.filter((p) => p.slug !== pick.slug) : [...current, pick]);
  }, []);
  const remove = useCallback((slug: string) => writeWatchlist(readWatchlist().filter((p) => p.slug !== slug)), []);
  return { picks, toggle, remove };
}

/** The toggle on a model row or page. Labelled in words (Watch / Watching), never a bare glyph. */
export function WatchButton({ slug, name }: { slug: string; name: string }) {
  const { picks, toggle } = useWatchlist();
  const watched = picks.some((p) => p.slug === slug);
  return (
    <button
      type="button"
      className="btn"
      aria-pressed={watched}
      onClick={(e) => {
        e.preventDefault();
        toggle({ slug, name });
      }}
    >
      {watched ? 'Watching' : 'Watch'}
    </button>
  );
}
