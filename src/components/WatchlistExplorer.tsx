'use client';

/**
 * /watchlist as an island: the slugs live in this browser, so the server can only render the
 * shell; the rows arrive from GET /api/models/watchlist once the list is read. Until then the
 * page shows the skeleton, not a flash of "nothing watched" that would be a lie a second later.
 * Removal is local and instant (the list is the reader's, not the server's); prices and the
 * latest change are the mirror's, fetched fresh on every visit.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Empty, Section, SkeletonPage } from '@/components/ui';
import { readWatchlist, useWatchlist } from '@/components/watchlist';
import { AddToCompare } from '@/components/tray';
import { fetchApi } from '@/components/live';
import { contextLabel, priceLabel } from '@/lib/format';

type Row = Awaited<ReturnType<typeof import('@/lib/services/catalogue').modelsBySlugs>>['data'][number];

export default function WatchlistExplorer() {
  const { picks, remove } = useWatchlist();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const slugs = readWatchlist().map((p) => p.slug);
    if (!slugs.length) {
      setRows([]);
      return;
    }
    let live = true;
    fetchApi<Row[], { missing?: string[] }>(`/api/models/watchlist?ids=${encodeURIComponent(slugs.join(','))}`, new AbortController().signal)
      .then(({ data, meta }) => {
        if (!live) return;
        setRows(data);
        setMissing(meta?.missing ?? []);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [picks.length]);

  if (rows === null && !failed) return <SkeletonPage rows={4} />;

  return (
    <div className="space-y-6">
      {failed && (
        <Empty title="The watchlist could not be loaded" hint="The slugs are still saved in this browser; reloading usually fixes a failed fetch." />
      )}
      {!failed && rows !== null && rows.length === 0 && (
        <Empty
          title="Nothing watched yet"
          hint="Watch a model from the catalogue and it will be tracked here: current cheapest price, and the last recorded change."
          action={{ href: '/models', label: 'Browse models' }}
        />
      )}
      {!failed && rows !== null && rows.length > 0 && (
        <>
          <Section id="watched" title="Watched models" count={rows.length} />
          <div className="tablewrap">
            <table className="stack-sm min-w-[900px] text-sm">
              <caption className="sr-only">Watched models with cheapest current prices and the latest recorded change</caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Lab</th>
                  <th scope="col" className="text-right">Context</th>
                  <th scope="col" className="text-right">Cheapest in / out per 1M</th>
                  <th scope="col" className="text-right">Providers</th>
                  <th scope="col">Latest change</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.slug}>
                    <td data-title>
                      <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${r.slug}`}>{r.name}</Link>
                      {r.deprecatedAt && <span className="flag flag-warn ml-2">deprecated</span>}
                    </td>
                    <td>{r.lab.name}</td>
                    <td className="num text-right">{contextLabel(r.contextWindow)}</td>
                    <td className="num text-right">{priceLabel(r.cheapest.prompt)} / {priceLabel(r.cheapest.completion)}</td>
                    <td className="num text-right">{r.providerCount}</td>
                    <td className="text-[var(--muted)]">
                      {r.latestChange ? (
                        <>
                          {r.latestChange.field}: <span className="num">{r.latestChange.oldValue ?? '—'} → {r.latestChange.newValue ?? '—'}</span>
                          <span className="block text-xs text-[var(--faint)]">{new Date(r.latestChange.at).toISOString().slice(0, 10)}</span>
                        </>
                      ) : (
                        'none recorded'
                      )}
                    </td>
                    <td>
                      <span className="flex flex-wrap gap-2">
                        <AddToCompare slug={r.slug} name={r.name} />
                        <button type="button" className="btn" onClick={() => remove(r.slug)}>Remove</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {missing.length > 0 && (
        <p className="text-sm text-[var(--faint)]">
          No longer in the catalogue: <span className="num">{missing.join(', ')}</span>. They stay in this browser's list until removed there.
        </p>
      )}
    </div>
  );
}
