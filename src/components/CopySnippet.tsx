'use client';

/**
 * A copyable API call for this record. The origin is read from the address bar after mount, so
 * the snippet is correct on localhost, on a preview and in production without the server having
 * to guess where it is deployed; before hydration it shows the path, which is the honest part.
 */
import { useEffect, useState } from 'react';

export default function CopySnippet({ path }: { path: string }) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const command = `curl -s ${origin}${path}`;

  return (
    <div>
      <pre className="snippet">{command}</pre>
      <button
        type="button"
        className="btn mt-3"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy curl'}
      </button>
    </div>
  );
}
