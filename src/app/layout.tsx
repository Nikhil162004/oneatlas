import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Archivo } from 'next/font/google';
import { getStats } from '@/lib/services/stats';
import SiteSearch from '@/components/SiteSearch';
import CommandPalette from '@/components/CommandPalette';
import CompareTray from '@/components/tray';
import './globals.css';

/*
  One webfont, and it is the one that carries identity. Archivo at 400 to 600 is a grotesque with
  real contrast at small sizes and is not on the list of faces every generated site reaches for.
  Numerals use the platform mono stack instead of a second download: `.num` asks for tabular figures
  via font-variant-numeric, which is the property that actually matters in a column of prices, and
  ui-monospace resolves to SF Mono / Cascadia / Roboto Mono locally. One fewer blocking request.
*/
const body = Archivo({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-archivo', display: 'swap' });

/*
  `viewportFit: cover` is what makes the safe-area insets in globals.css mean anything; without it
  the browser keeps its own margin and `env(safe-area-inset-*)` is always 0. `colorScheme: dark` is
  the meta twin of `color-scheme: dark`, and it is what keeps a phone from painting a white
  overscroll page behind a black document.
*/
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor: '#08090b',
};

export const metadata: Metadata = {
  title: { default: 'OneAtlas', template: '%s · OneAtlas' },
  description: 'Every AI model on the public catalogue, with the providers serving it and what each charges.',
};

const NAV = [
  ['/models', 'Models'],
  ['/rankings', 'Rankings'],
  ['/compare', 'Compare'],
  ['/labs', 'Labs'],
  ['/providers', 'Providers'],
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Header and footer are on every page, and the mirror date has to be right on every page, so it is
  // read here once. A failure leaves the line off rather than taking the layout down.
  const stats = await getStats().catch(() => null);
  const mirrored = stats?.mirroredAt
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(stats.mirroredAt)
    : null;

  return (
    <html lang="en" className={body.variable}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="chrome sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]">
          <div className="shell chrome-row">
            <Link href="/" className="num shrink-0 text-[15px] font-medium tracking-[-0.03em]">
              one<span className="text-[var(--accent)]">atlas</span>
            </Link>
            <nav aria-label="Sections" className="navstrip -mx-4 flex min-w-0 flex-1 gap-x-4 px-4 text-sm sm:mx-0 sm:px-0">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="py-2 text-[var(--muted)] hover:text-[var(--fg)]">{label}</Link>
              ))}
              {/* On a phone the search field would crowd the strip; the page it goes to is the same form. */}
              <Link href="/search" className="py-2 text-[var(--muted)] hover:text-[var(--fg)] md:hidden">Search</Link>
            </nav>
            <SiteSearch />
            <CommandPalette />
          </div>
        </header>
        <main id="main" className="shell py-8">{children}</main>
        <footer className="shell shell-end flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-[var(--line)] py-8 text-xs text-[var(--faint)]">
          <span>OpenRouter public catalogue{mirrored ? `, mirrored ${mirrored}` : ''}{stats?.models ? ` · ${stats.models} models` : ''}</span>
          <Link className="underline" href="/api">JSON API</Link>
        </footer>
        <CompareTray />
      </body>
    </html>
  );
}
