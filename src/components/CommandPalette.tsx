'use client';

/**
 * Quick search, ⌘K (or Ctrl+K) from anywhere. One bounded lookup against `GET /api/search`
 * (the same three groups the /search page renders), keyboard-first: arrows move, Enter opens,
 * Esc closes. It is a navigation aid, not a second search implementation, so a result here and
 * the same term on /search can never disagree. Choosing a result navigates through the router,
 * which keeps the chrome mounted: no document load, same as every other control since 0008.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/components/live';

type Groups = Awaited<ReturnType<typeof import('@/lib/services/catalogue').globalSearch>>['data'];
type Item = { slug: string; name: string; meta: string; href: string; group: string };

function flatten(groups: Groups): Item[] {
  return [
    ...groups.models.map((m) => ({ slug: m.slug, name: m.name, meta: `${m.lab.name} · ${m.modelType.toLowerCase()}`, href: `/models/${m.slug}`, group: 'Models' })),
    ...groups.labs.map((l) => ({ slug: l.slug, name: l.name, meta: `${l.modelCount} models`, href: `/labs/${l.slug}`, group: 'Labs' })),
    ...groups.providers.map((p) => ({ slug: p.slug, name: p.name, meta: `${p.listingCount} listings`, href: '/providers', group: 'Providers' })),
  ];
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setItems([]);
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open ]);

  const go = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  const search = (value: string) => {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    const term = value.trim();
    if (!term) {
      setItems([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const { data } = await fetchApi<Groups, unknown>(`/api/search?q=${encodeURIComponent(term)}&perGroup=5`, new AbortController().signal);
        setItems(flatten(data));
        setActive(0);
      } catch {
        setItems([]);
      }
    }, 250);
  };

  return (
    <>
      <button type="button" className="btn ml-2 hidden shrink-0 md:inline-flex" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="hidden xl:inline">Quick search</span> <span className="num text-[11px] text-[var(--faint)]">⌘K</span>
      </button>
      {open && (
        <div className="palette-backdrop" onClick={() => setOpen(false)}>
          <div
            className="palette-panel card"
            role="dialog"
            aria-modal="true"
            aria-label="Quick search"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                go(items[active]);
              }
            }}
          >
            <label className="sr-only" htmlFor="palette-q">Quick search</label>
            <input
              id="palette-q"
              ref={inputRef}
              className="field w-full"
              type="search"
              value={q}
              onChange={(e) => search(e.target.value)}
              placeholder="models, labs, providers"
              autoComplete="off"
              enterKeyHint="search"
            />
            {items.length > 0 ? (
              <ul className="mt-3 max-h-[50vh] space-y-1 overflow-auto">
                {items.map((item, i) => (
                  <li key={`${item.group}-${item.slug}`}>
                    <button
                      type="button"
                      className="palette-item"
                      data-active={i === active || undefined}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.name}</span>
                        <span className="num block text-xs text-[var(--faint)]">{item.meta}</span>
                      </span>
                      <span className="tag shrink-0">{item.group}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--faint)]">{q.trim() ? 'No matches in the mirrored catalogue.' : 'Type to search. Enter opens, Esc closes.'}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
