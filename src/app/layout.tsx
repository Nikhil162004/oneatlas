import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist_Mono } from 'next/font/google';
import './globals.css';

// Only the font we actually use is loaded: Inter variable is 179 KB of download for one weight.
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'OneAtlas', template: '%s · OneAtlas' },
  description: 'One pass through every open-model catalogue: models, labs, providers and benchmarks in one read API.',
};

const NAV = [
  ['/models', 'Models'],
  ['/rankings', 'Rankings'],
  ['/compare', 'Compare'],
  ['/labs', 'Labs'],
  ['/providers', 'Providers'],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body className="min-h-screen bg-[var(--bg)] text-[15px] leading-[1.55] text-[var(--fg)] antialiased">
        <a className="skip" href="#main">Skip to content</a>
        <header className="border-b border-[var(--line)] bg-[var(--bg)]">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">One<span className="text-[var(--accent)]">Atlas</span></Link>
            <nav aria-label="Sections" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="text-[var(--muted)] underline-offset-4 hover:underline">{label}</Link>
              ))}
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-[1400px] px-4 py-8 text-xs text-[var(--muted)]">
          Data mirrored from OpenRouter&apos;s public catalogue. Built for the OneAtlas full-stack
          assignment; the same numbers back the JSON API at <code>/api/models</code>.
        </footer>
      </body>
    </html>
  );
}
