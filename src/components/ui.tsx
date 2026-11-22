/** Shared presentational pieces. All server components; none of them ship JavaScript. */
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
  reasoning: 'reasoning',
  tools: 'tools',
  structuredOutput: 'json',
  visionInput: 'vision',
  openWeights: 'open',
};

/**
 * Only the capabilities a model actually has, as tags. A row of five tick-and-cross marks per model
 * repeats what the tags say and makes the table scan like a form; absence is already information.
 */
export function CapabilityTags({ caps }: { caps: Record<string, boolean> }) {
  const on = Object.entries(CAP_LABEL).filter(([k]) => caps[k]);
  if (!on.length) return <span className="num text-[11px] text-[var(--faint)]">none recorded</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {on.map(([k]) => (
        <span key={k} className="tag tag-on" title={CAP_LABEL[k]}>
          {CAP_SHORT[k]}
        </span>
      ))}
    </span>
  );
}

/** Heading with a rule that runs to the edge of the block: marks the section without boxing it. */
export function Section({ id, title, count, right }: { id: string; title: string; count?: number | null; right?: React.ReactNode }) {
  return (
    <h2 id={id} className="section">
      {title}
      {count !== undefined && count !== null && <small className="num">{count}</small>}
      <span aria-hidden="true" />
      {right}
    </h2>
  );
}

/** A percentage rendered as a bar as well as a number, because coverage is about shape at a glance. */
export function Meter({ value, label, max = 100 }: { value: number | null; label?: string; max?: number }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className="block">
      <span className="meter block" style={{ '--v': `${pct}%` } as React.CSSProperties} />
      {label && <span className="num mt-1 block text-[11px] text-[var(--faint)]">{label}</span>}
    </span>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <p role="status" className="card card-tight text-sm text-[var(--muted)]">{children}</p>;
}

/** Plain sentence, then the action. No "Oops", no explanation of what the screen is for. */
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: { href: string; label: string } }) {
  return (
    <div className="card py-12 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>}
      {action && (
        <Link className="btn mt-4" href={action.href}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Cursor paging as two links. The cursor is a query param like any other, so there is no client
 * component here, and `total` is only stated on page 1 (keyset paging does not count the rest).
 */
export function Pager({ params, meta, pageHref }: { params: URLSearchParams; meta: { total: number | null; limit: number; nextCursor: string | null }; pageHref: (cursor: string) => string }) {
  return (
    <nav aria-label="Pagination" className="rowline">
      <span className="num text-sm text-[var(--muted)]">
        {meta.total === null ? `${meta.limit} per page` : `${meta.total} results`}
      </span>
      {meta.nextCursor ? (
        <Link className="btn" href={pageHref(meta.nextCursor)}>
          Next {meta.limit}
        </Link>
      ) : (
        <span className="text-sm text-[var(--faint)]">End of results</span>
      )}
    </nav>
  );
}

export function StatRow({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="card card-tight">
          <dt className="label">{label}</dt>
          <dd className="num mt-1 text-[24px] leading-none">{value ?? EMDASH}</dd>
        </div>
      ))}
    </dl>
  );
}
