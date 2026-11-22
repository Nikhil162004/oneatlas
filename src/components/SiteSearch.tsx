'use client';

/**
 * The header search box. It changes the page, so it navigates, but through the router: the
 * chrome (header, footer) never unmounts and there is no document reload. Once on /search,
 * SearchExplorer takes over and further typing is local to that component.
 */
import { useRouter } from 'next/navigation';

export default function SiteSearch() {
  const router = useRouter();
  return (
    <form
      method="get"
      action="/search"
      className="ml-auto hidden shrink-0 md:block"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
      }}
    >
      <label className="sr-only" htmlFor="site-search">Search models, labs and providers</label>
      <input id="site-search" className="field w-40 xl:w-60" type="search" name="q" placeholder="claude, mistral, DeepInfra" enterKeyHint="search" autoComplete="off" />
    </form>
  );
}
