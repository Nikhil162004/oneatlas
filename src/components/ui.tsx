/** Shared presentational pieces, used by server pages and by the client islands alike. */
import Link from 'next/link';
import { EMDASH } from '@/lib/format';
import { hrefWith, type RawParams } from '@/lib/page';

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
export function LabMark({ slug, name }: { slug: string; name: string }) {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span className="labmark" style={{ background: `hsl(${hash} 32% 34%)` }} aria-hidden="true">
      {initials || '?'}
    </span>
  );
}

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

/**
 * The line above a table: how many rows you are looking at, what they are sorted by, and one × per
 * filter that is on. It exists because a URL you can only get out of by reloading is the difference
 * between a tool and a poster - and every × is a link that deletes one query parameter, so the URL
 * stays the only state. `note` and `count` come from the page, which got them from the query the
 * service actually ran, so this line cannot disagree with the rows under it.
 */
export function FilterBar({
  path,
  raw,
  count,
  note,
  fields,
}: {
  path: string;
  raw: RawParams;
  count: string;
  note?: string;
  fields: Array<{ key: string; label: string; multi?: boolean }>;
}) {
  const chips: Array<{ text: string; href: string }> = [];
  for (const { key, label, multi } of fields) {
    const value = raw[key];
    if (value === undefined || value === '') continue;
    // A repeated key (`capabilities=tools&capabilities=vision`, what the checkbox group submits) and
    // a comma list (what a person types) are the same filter, so `multi` reads both as a list. Keys
    // without it are single strings: a search term containing a comma must stay one chip, or the ×
    // would delete half of a query.
    const all = (Array.isArray(value) ? value : multi ? String(value).split(',') : [value])
      .map((x) => x.trim())
      .filter(Boolean);
    for (const one of all) {
      const rest = all.filter((x) => x !== one);
      chips.push({
        // A checkbox filter's value is `true`, which is the parameter's business, not the reader's.
        text: one === 'true' ? label : all.length > 1 ? one : `${label} ${one}`,
        href: hrefWith(raw, { [key]: rest.length ? rest.join(',') : null }, path),
      });
    }
  }
  return (
    <div className="subbar">
      <span className="num subbar-count">{count}</span>
      {note && <span>{note}</span>}
      {chips.length > 0 && (
        <>
          <ul className="subbar-chips">
            {chips.map((c) => (
              <li key={c.text}>
                <a className="chip-x" href={c.href}>
                  {c.text}
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">clear this filter</span>
                </a>
              </li>
            ))}
          </ul>
          <a className="subbar-clear" href={path}>
            Clear all
          </a>
        </>
      )}
    </div>
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
 * Cursor paging as links. The cursor is a query param like any other; inside ModelsExplorer the
 * click is intercepted and fetched in place, and `total` is only stated on page 1 (keyset paging
 * does not count the rest).
 */
/**
 * The wait, shaped like the page: a heading bar and a card of lines. Route-level `loading.tsx`
 * files render this while the server component reads the database, so a slow query shows the
 * page's silhouette instead of the previous page freezing or a blank main. Widths step down
 * irregularly (88/79/70…) because real text never aligns to a grid.
 */
export function SkeletonPage({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div>
        <div className="skeleton" style={{ height: 30, width: '34%' }} />
        <div className="skeleton mt-3" style={{ height: 15, width: '58%' }} />
      </div>
      <div className="card space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 15, width: `${88 - (i % 4) * 8}%` }} />
        ))}
      </div>
    </div>
  );
}

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
