import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'OneAtlas — every AI model, compared',
  description: 'Specs, pricing, capabilities and providers for AI models, in one place.',
};

/** Shell only. The screens are deliberately not here — see docs/ui-brief.md for the spec. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="border-b border-[var(--line)]">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3" aria-label="Main">
            <Link href="/">OneAtlas</Link>
            <Link href="/models">Models</Link>
            <Link href="/rankings">Rankings</Link>
            <Link href="/labs">Labs</Link>
            <Link href="/providers">Providers</Link>
            <Link href="/compare">Compare</Link>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
