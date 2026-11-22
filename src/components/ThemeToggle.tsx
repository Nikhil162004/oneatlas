'use client';

/**
 * Light/dark, one button. The theme itself is a [data-theme] attribute on <html> (see
 * globals.css: components only ever read var(--…) tokens, so the attribute reskins the whole
 * site) plus this preference in localStorage. The initial value is applied by the blocking
 * script in the layout head, before first paint; this component only flips it afterwards,
 * which keeps hydration honest — the server never has to guess, and the button labels itself
 * from the attribute that is actually on the document.
 */
import { useEffect, useState } from 'react';

const KEY = 'oneatlas:theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  const flip = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // A theme that lasts one pageview is a degradation, not an error worth surfacing.
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="btn ml-2 hidden shrink-0 sm:inline-flex"
      onClick={flip}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      aria-pressed={theme === 'light'}
    >
      {theme === 'light' ? 'Dark' : 'Light'}
    </button>
  );
}
