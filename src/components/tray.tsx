'use client';

/**
 * The compare tray: picks collected anywhere (model rows, alternative cards) and carried to
 * /compare. Picks are slugs plus names, nothing more: the comparison itself is still resolved
 * by `GET /api/models/compare` from the URL, so the tray is a clipboard, not a second source of
 * truth. It persists in localStorage because a shortlist that dies on navigation is a form you
 * have to fill in twice; components stay in sync through a window event, since the storage
 * event does not fire in the tab that wrote it.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type TrayPick = { slug: string; name: string };

const KEY = 'oneatlas:compare';
const EVENT = 'oneatlas:compare-changed';

export function readTray(): TrayPick[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as TrayPick[];
    return Array.isArray(raw) ? raw.filter((p) => p && typeof p.slug === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

function writeTray(picks: TrayPick[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(picks.slice(0, 6)));
  } catch {
    // Private mode or a full disk: the tray becomes session-only, which is a degradation, not an error.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useTray() {
  const [picks, setPicks] = useState<TrayPick[]>([]);
  const sync = useCallback(() => setPicks(readTray()), []);
  useEffect(() => {
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  const toggle = useCallback((pick: TrayPick) => {
    const current = readTray();
    writeTray(current.some((p) => p.slug === pick.slug) ? current.filter((p) => p.slug !== pick.slug) : [...current, pick]);
  }, []);
  const clear = useCallback(() => writeTray([]), []);
  return { picks, toggle, clear };
}

/** The button on a model row or card. Shows its own state, so a list reads as already-picked. */
export function AddToCompare({ slug, name }: { slug: string; name: string }) {
  const { picks, toggle } = useTray();
  const picked = picks.some((p) => p.slug === slug);
  return (
    <button
      type="button"
      className="btn"
      aria-pressed={picked}
      onClick={(e) => {
        e.preventDefault();
        toggle({ slug, name });
      }}
    >
      {picked ? 'In compare tray' : 'Add to compare'}
    </button>
  );
}

/** Fixed tray, bottom corner. Absent when empty and on /compare itself, where it would point at the page you are on. */
export default function CompareTray() {
  const { picks, clear } = useTray();
  const pathname = usePathname();
  if (!picks.length || pathname?.startsWith('/compare')) return null;
  return (
    <div className="card fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 shadow-none" role="status">
      <span className="num text-sm">
        {picks.length} to compare
        <span className="block max-w-56 truncate text-xs font-normal text-[var(--faint)]">{picks.map((p) => p.name).join(', ')}</span>
      </span>
      <Link className="btn btn-primary" href={`/compare?ids=${picks.map((p) => p.slug).join(',')}`}>Compare</Link>
      <button type="button" className="btn" onClick={clear}>Clear</button>
    </div>
  );
}
