/**
 * One copy of this file serves every route group. The retry is a reload, not a client-side refetch
 * we would have to build ourselves: the data comes from the server, so "try again" means "ask the
 * server again".
 */
'use client';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h2 className="text-lg font-semibold">This page could not be loaded</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        The catalogue or the database did not answer. Nothing you typed was lost — filters live in the URL.
      </p>
      {error.digest && <p className="num mt-2 text-xs text-[var(--faint)]">ref {error.digest}</p>}
      <button type="button" onClick={reset} className="btn mt-4">Try again</button>
    </div>
  );
}
