import WatchlistExplorer from '@/components/WatchlistExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Watchlist' };

/**
 * The reader's own shortlist. The list itself lives in the browser (see components/watchlist),
 * so this page is a shell: the island reads the slugs, resolves them through
 * GET /api/models/watchlist, and shows current prices plus the last recorded change per model.
 */
export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Watchlist</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Models you are tracking, priced as the mirror has them now. The list is kept in this browser only;
          changes to watched models are gathered at <a className="underline" href="/changes">Changes</a>.
        </p>
      </div>
      <WatchlistExplorer />
    </div>
  );
}
