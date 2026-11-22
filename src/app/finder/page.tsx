import FinderExplorer from '@/components/FinderExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Model finder' };

/**
 * A front door for readers who know the job but not the filters. Three answers become the
 * catalogue's own query parameters; nothing about the result is findable only from here.
 */
export default function FinderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Model finder</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Answer three questions. You will land on the catalogue, filtered, where every control stays available.
        </p>
      </div>
      <FinderExplorer />
    </div>
  );
}
