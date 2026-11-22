import type { Metadata } from 'next';
import Link from 'next/link';
import { Archivo } from 'next/font/google';
import { getStats } from '@/lib/services/stats';
import './globals.css';

/*
  One webfont, and it is the one that carries identity. Archivo at 400 to 600 is a grotesque with
  real contrast at small sizes and is not on the list of faces every generated site reaches for.
  Numerals use the platform mono stack instead of a second download: `.num` asks for tabular figures
  via font-variant-numeric, which is the property that actually matters in a column of prices, and
  ui-monospace resolves to SF Mono / Cascadia / Roboto Mono locally. One fewer blocking request.
*/
const body = Archivo({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-archivo', display: 'swap' });

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
      <body className="min-h-screen">
        <a className="skip" href="#main">Skip to content</a>
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-8">
            <Link href="/" className="num text-[15px] font-medium tracking-[-0.03em]">
              one<span className="text-[var(--accent)]">atlas</span>
            </Link>
            <nav aria-label="Sections" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="text-[var(--muted)] hover:text-[var(--fg)]">{label}</Link>
              ))}
            </nav>
            <form method="get" action="/search" className="ml-auto hidden md:block">
              <label className="sr-only" htmlFor="site-search">Search models, labs and providers</label>
              <input id="site-search" className="field w-56" type="search" name="q" placeholder="claude, mistral, DeepInfra" />
            </form>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">{children}</main>
        <footer className="mx-auto flex max-w-[1400px] flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-[var(--line)] px-4 py-8 text-xs text-[var(--faint)] lg:px-8">
          <span>OpenRouter public catalogue{mirrored ? `, mirrored ${mirrored}` : ''}{stats?.models ? ` · ${stats.models} models` : ''}</span>
          <Link className="underline" href="/api/models">JSON API</Link>
          <Link className="underline" href="/api/stats">stats</Link>
        </footer>
      </body>
    </html>
  );
}
