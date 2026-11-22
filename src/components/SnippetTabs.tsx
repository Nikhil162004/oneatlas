'use client';

/**
 * The record call in the three shapes a developer pastes: curl, Python, JavaScript. Same URL,
 * same response — the tabs are presentations of one request, so they cannot drift apart. The
 * origin is read from the address bar after mount (localhost, preview and production each get
 * a correct snippet without the server guessing its own deployment); before hydration the
 * path alone is shown, which is the honest part.
 */
import { useEffect, useState } from 'react';

const TABS = ['curl', 'Python', 'JavaScript'] as const;
type Tab = (typeof TABS)[number];

function snippet(tab: Tab, url: string): string {
  if (tab === 'Python') {
    return `import requests\n\nmodel = requests.get("${url}", timeout=30).json()["data"]\nprint(model["name"], model["pricing"])`;
  }
  if (tab === 'JavaScript') {
    return `const res = await fetch("${url}");\nif (!res.ok) throw new Error(\`OneAtlas \${res.status}\`);\nconst { data: model } = await res.json();\nconsole.log(model.name, model.pricing);`;
  }
  return `curl -s ${url}`;
}

export default function SnippetTabs({ path }: { path: string }) {
  const [origin, setOrigin] = useState('');
  const [tab, setTab] = useState<Tab>('curl');
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const code = snippet(tab, `${origin}${path}`);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Snippet language">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className="chip"
            style={
              tab === t
                ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }
                : undefined
            }
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <pre className="snippet mt-3">{code}</pre>
      <button
        type="button"
        className="btn mt-3"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : `Copy ${tab}`}
      </button>
    </div>
  );
}
