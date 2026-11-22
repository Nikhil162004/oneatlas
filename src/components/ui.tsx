/** Small presentational pieces shared by the screens. All server components. */
import Link from 'next/link';
import { EMDASH } from '@/lib/format';

export const CAP_LABEL: Record<string, string> = {
  reasoning: 'Reasoning',
  tools: 'Tool calling',
  structuredOutput: 'Structured output',
  visionInput: 'Vision input',
  openWeights: 'Open weights',
};

const CAP_SHORT: Record<string, string> = {
  reasoning: 'Reason',
  tools: 'Tools',
  structuredOutput: 'JSON',
  visionInput: 'Vision',
  openWeights: 'Open',
};

export function CapabilityBadges({ caps, short = true }: { caps: Record<string, boolean>; short?: boolean }) {
  const on = Object.entries(CAP_LABEL).filter(([k]) => caps[k]);
  if (!on.length) return <span className="text-[var(--muted)]" title="No capabilities recorded">{EMDASH}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {on.map(([k]) => (
        <span key={k} title={CAP_LABEL[k]} className="rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
          {short ? CAP_SHORT[k] : CAP_LABEL[k]}
        </span>
      ))}
    </span>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--muted)]">
      {children}
    </p>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--line)] px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

/**
 * Anchor paging. The cursor is just another query param, so "next" is a link, not a client
 * component — the whole app stays server-rendered. `total` is null on pages after the first by
 * design (keyset paging does not count), so the copy must not claim a position.
 */
export function Pager({ basePath, params, meta }: { basePath: string; params: URLSearchParams; meta: { total: number | null; limit: number; nextCursor: string | null } }) {
  const next = new URLSearchParams(params);
  if (meta.nextCursor) next.set('cursor', meta.nextCursor);
  else next.delete('cursor');
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-sm">
      <span className="text-[var(--muted)]">
        {meta.total === null ? `${meta.limit} per page` : `${meta.total} results, ${meta.limit} per page`}
      </span>
      {meta.nextCursor ? (
        <Link className="underline" href={`?${next.toString()}`}>Next {meta.limit} &rarr;</Link>
      ) : (
        <span className="text-[var(--muted)]">End of results</span>
      )}
    </nav>
  );
}

export function StatRow({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
          <dd className="num text-lg">{value ?? EMDASH}</dd>
        </div>
      ))}
    </dl>
  );
}
