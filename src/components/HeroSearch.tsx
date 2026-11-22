'use client';

/**
 * The front door's search: one large field on the home hero. Submitting navigates through the
 * router to /search with the term (the chrome never reloads); the field is a real GET form
 * underneath, so it also works before hydration and with JavaScript off.
 */
import { useRouter } from 'next/navigation';

export default function HeroSearch() {
  const router = useRouter();
  return (
    <form
      method="get"
      action="/search"
      className="mt-6 flex max-w-xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
      }}
    >
      <label className="sr-only" htmlFor="hero-search">Search models, labs and providers</label>
      <input
        id="hero-search"
        className="field min-h-[44px] flex-1 text-base"
        type="search"
        name="q"
        placeholder="mistral, llama, gemini…"
        enterKeyHint="search"
        autoComplete="off"
      />
      <button type="submit" className="btn btn-primary min-h-[44px]">Search</button>
    </form>
  );
}
