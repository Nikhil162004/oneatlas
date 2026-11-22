'use client';

/**
 * The /search screen as a component island (docs/decisions/0008). Submitting (or pausing while
 * typing) fetches `GET /api/search` and replaces only the three result groups; the term stays in
 * `?q=`, so a search is still a link. The header search box navigates here, and after that every
 * keystroke is local to this component.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Empty, Notice, Section } from '@/components/ui';
import { fetchApi, syncUrl } from '@/components/live';

type SearchResult = Awaited<ReturnType<typeof import('@/lib/services/catalogue').globalSearch>>;
type Groups = SearchResult['data'];
type Problem = 'needq' | 'unavailable' | null;

type Item = { slug: string; name: string; meta: string; href: string };

function toColumns(groups: Groups): Array<[string, Item[]]> {
  return [
    ['Models', groups.models.map((m) => ({ slug: m.slug, name: m.name, meta: `${m.lab.name} · ${m.modelType.toLowerCase()}`, href: `/models/${m.slug}` }))],
    ['Labs', groups.labs.map((l) => ({ slug: l.slug, name: l.name, meta: `${l.modelCount} models`, href: `/labs/${l.slug}` }))],
    ['Providers', groups.providers.map((p) => ({ slug: p.slug, name: p.name, meta: `${p.listingCount} listings`, href: '/providers' }))],
  ];
}

export default function SearchExplorer({
  initialQ,
  initialGroups,
  initialProblem,
}: {
  initialQ: string;
  initialGroups: Groups | null;
  initialProblem: Problem;
}) {
  const [q, setQ] = useState(initialQ);
  const [term, setTerm] = useState(initialQ);
  const [groups, setGroups] = useState<Groups | null>(initialGroups);
  const [problem, setProblem] = useState<Problem>(initialProblem);
  const [loading, setLoading] = useState(false);
  const request = useRef<{ id: number; ctrl: AbortController | null }>({ id: 0, ctrl: null });
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (value: string, push: boolean) => {
    const termValue = value.trim();
    if (push) {
      const sp = new URLSearchParams();
      if (termValue) sp.set('q', termValue);
      syncUrl('/search', sp);
    }
    if (!termValue) {
      setTerm('');
      setGroups(null);
      setProblem('needq');
      return;
    }
    const id = ++request.current.id;
    request.current.ctrl?.abort();
    const ctrl = new AbortController();
    request.current.ctrl = ctrl;
    setLoading(true);
    try {
      const { data } = await fetchApi<Groups, SearchResult['meta']>(`/api/search?q=${encodeURIComponent(termValue)}&perGroup=5`, ctrl.signal);
      if (request.current.id !== id) return;
      setTerm(termValue);
      setGroups(data);
      setProblem(null);
    } catch {
      if (request.current.id !== id) return;
      setTerm(termValue);
      setGroups(null);
      setProblem('unavailable');
    } finally {
      if (request.current.id === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      const value = new URLSearchParams(window.location.search).get('q') ?? '';
      setQ(value);
      void load(value, false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load]);

  const empty = groups !== null && groups.models.length + groups.labs.length + groups.providers.length === 0;
  const columns = groups ? toColumns(groups) : [];

  return (
    <>
      <form
        method="get"
        action="/search"
        className="flex max-w-xl flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (debounce.current) clearTimeout(debounce.current);
          void load(q, true);
        }}
      >
        <label className="sr-only" htmlFor="q">Search term</label>
        <input
          id="q"
          className="field min-w-[200px] flex-1"
          type="search"
          name="q"
          value={q}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            if (debounce.current) clearTimeout(debounce.current);
            // Type-ahead, but debounced: one bounded lookup per pause, not per keystroke.
            debounce.current = setTimeout(() => void load(value, true), 350);
          }}
          placeholder="claude"
          enterKeyHint="search"
          autoComplete="off"
        />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      <span aria-live="polite" className="sr-only">{loading ? 'Searching' : ''}</span>
      <div className="results-live" data-loading={loading || undefined} aria-busy={loading || undefined}>
        {problem === 'needq' ? (
          <Notice>Type at least one character.</Notice>
        ) : problem === 'unavailable' || (term && !groups) ? (
          <Empty title="Search is unavailable" hint="The database did not answer. /api/search runs the same query and reports its own error." />
        ) : !groups ? null : empty ? (
          <Empty title={`Nothing matches “${term}”`} hint="Try part of a slug, for example claude or mistral." />
        ) : (
          <div className="grid gap-8 md:grid-cols-3">
            {columns.map(([title, items]) => (
              <section key={title}>
                <Section id={title} title={title} count={items.length} />
                {items.length ? (
                  <ul className="space-y-2">
                    {items.map((i) => (
                      <li key={`${title}-${i.slug}`}>
                        <Link href={i.href} className="card card-tight card-hover block">
                          <span className="block font-medium leading-snug">{i.name}</span>
                          <span className="num mt-0.5 block text-xs text-[var(--faint)]">{i.meta}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--faint)]">No {title.toLowerCase()} match.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
