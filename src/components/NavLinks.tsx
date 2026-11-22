'use client';

/**
 * The section strip. A client component only so the current section can be marked: the links
 * themselves are ordinary anchors, and usePathname is what tells "you are in Rankings" apart
 * from the eleven other sections now sharing the row. Matching is by first segment, so
 * /models/{lab}/{slug} still lights Models.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  const pathname = usePathname();
  return (
    <>
      {items.map(([href, label]) => {
        const current = pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className="py-2 text-[var(--muted)] hover:text-[var(--fg)]"
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
