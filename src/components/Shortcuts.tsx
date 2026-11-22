'use client';

/**
 * Keyboard movement for the whole site: `g` then a letter goes to a section, `?` opens this
 * list. It owns nothing the palette does not: while a dialog is open (⌘K, or this overlay)
 * the keys belong to it, and while the reader is typing in a field the letters belong to the
 * field. Navigation goes through the router, so the chrome never reloads — the same rule as
 * every other control since 0008.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const GO: Record<string, [string, string]> = {
  m: ['/models', 'Models'],
  r: ['/rankings', 'Rankings'],
  b: ['/benchmarks', 'Benchmarks'],
  c: ['/compare', 'Compare'],
  l: ['/labs', 'Labs'],
  p: ['/providers', 'Providers'],
  w: ['/watchlist', 'Watchlist'],
  x: ['/changes', 'Changes'],
  s: ['/status', 'Status'],
  h: ['/', 'Home'],
};

export default function Shortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingG = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (open) return;
      // A modal that is not this one (the ⌘K palette) owns the keyboard while it is up.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const now = Date.now();
      if (e.key === 'g') {
        pendingG.current = now;
        return;
      }
      const dest = GO[e.key];
      if (dest && now - pendingG.current < 900) {
        e.preventDefault();
        pendingG.current = 0;
        router.push(dest[0]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, open]);

  if (!open) return null;
  return (
    <div className="palette-backdrop" onClick={() => setOpen(false)}>
      <div
        className="palette-panel card"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <p className="flex items-baseline justify-between">
          <span className="font-medium">Keyboard shortcuts</span>
          <button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li className="flex justify-between gap-4"><span>Quick search</span><span className="tag">Ctrl/⌘ K</span></li>
          {Object.entries(GO).map(([key, [, label]]) => (
            <li key={key} className="flex justify-between gap-4">
              <span>Go to {label}</span>
              <span className="tag">g then {key}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4"><span>This list</span><span className="tag">?</span></li>
          <li className="flex justify-between gap-4"><span>Close</span><span className="tag">Esc</span></li>
        </ul>
      </div>
    </div>
  );
}
