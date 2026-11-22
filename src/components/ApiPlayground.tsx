'use client';

/**
 * The API, runnable. Pick a route, fill its parameters, and the browser calls this deployment
 * and shows the real envelope — status, milliseconds and all. It exists because the /api page
 * made a promise ("these routes answer like this") that a reader previously had to verify in
 * a terminal; the playground is the verification, in the page. Only the deployment's own read
 * routes are offered, and the request is a plain GET against the origin being read.
 */
import { useState } from 'react';

type Field = { name: string; label: string; placeholder: string; initial?: string };
type Endpoint = { id: string; label: string; path: string; fields: Field[] };

const ENDPOINTS: Endpoint[] = [
  {
    id: 'models',
    label: 'GET /api/models',
    path: '/api/models',
    fields: [
      { name: 'q', label: 'q (search)', placeholder: 'llama' },
      { name: 'capabilities', label: 'capabilities', placeholder: 'vision,tools' },
      { name: 'maxPrice', label: 'maxPrice', placeholder: '0.1' },
      { name: 'sort', label: 'sort', placeholder: 'priceLow', initial: 'priceLow' },
      { name: 'limit', label: 'limit', placeholder: '5', initial: '5' },
    ],
  },
  {
    id: 'model',
    label: 'GET /api/models/{lab}/{slug}',
    path: '/api/models/{lab}/{slug}',
    fields: [
      { name: 'lab', label: 'lab', placeholder: 'anthropic', initial: 'anthropic' },
      { name: 'slug', label: 'slug', placeholder: 'claude-fable-5.2', initial: 'claude-fable-5.2' },
    ],
  },
  {
    id: 'rankings',
    label: 'GET /api/rankings',
    path: '/api/rankings',
    fields: [
      { name: 'view', label: 'view', placeholder: 'value or blank' },
      { name: 'limit', label: 'limit', placeholder: '5', initial: '5' },
    ],
  },
  {
    id: 'compare',
    label: 'GET /api/models/compare',
    path: '/api/models/compare',
    fields: [{ name: 'ids', label: 'ids (a,b)', placeholder: 'two full slugs', initial: 'anthropic/claude-fable-5.2,google/gemini-2.5-pro' }],
  },
  { id: 'search', label: 'GET /api/search', path: '/api/search', fields: [{ name: 'q', label: 'q', placeholder: 'mistral', initial: 'mistral' }] },
  { id: 'stats', label: 'GET /api/stats', path: '/api/stats', fields: [] },
  { id: 'changes', label: 'GET /api/changes', path: '/api/changes', fields: [{ name: 'limit', label: 'limit', placeholder: '5', initial: '5' }] },
  { id: 'status', label: 'GET /api/status', path: '/api/status', fields: [] },
  { id: 'collections', label: 'GET /api/collections', path: '/api/collections', fields: [] },
];

export default function ApiPlayground() {
  const [endpoint, setEndpoint] = useState<Endpoint>(ENDPOINTS[0]!);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(ENDPOINTS[0]!.fields.map((f) => [f.name, f.initial ?? ''])),
  );
  const [out, setOut] = useState<{ status: number; ms: number; bytes: number; body: string } | null>(null);
  const [running, setRunning] = useState(false);

  const pick = (ep: Endpoint) => {
    setEndpoint(ep);
    setValues(Object.fromEntries(ep.fields.map((f) => [f.name, f.initial ?? ''])));
    setOut(null);
  };

  const buildUrl = () => {
    let path = endpoint.path;
    const query = new URLSearchParams();
    for (const f of endpoint.fields) {
      const v = (values[f.name] ?? '').trim();
      if (!v) continue;
      if (path.includes(`{${f.name}}`)) path = path.replace(`{${f.name}}`, encodeURIComponent(v));
      else query.set(f.name, v);
    }
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
  };

  const run = async () => {
    setRunning(true);
    const started = performance.now();
    try {
      const res = await fetch(buildUrl(), { headers: { accept: 'application/json' } });
      const text = await res.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Non-JSON (should not happen on these routes): show it raw rather than hiding it.
      }
      setOut({ status: res.status, ms: Math.round(performance.now() - started), bytes: text.length, body: body.slice(0, 6000) });
    } catch (err) {
      setOut({ status: 0, ms: Math.round(performance.now() - started), bytes: 0, body: String(err) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Endpoint</span>
          <select className="field mt-1" value={endpoint.id} onChange={(e) => pick(ENDPOINTS.find((x) => x.id === e.target.value)!)}>
            {ENDPOINTS.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </label>
        {endpoint.fields.map((f) => (
          <label key={f.name} className="block">
            <span className="label">{f.label}</span>
            <input
              className="field mt-1 w-44"
              value={values[f.name] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void run();
                }
              }}
            />
          </label>
        ))}
        <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={running}>
          {running ? 'Running…' : 'Run'}
        </button>
      </div>
      <p className="num mt-3 break-all text-xs text-[var(--faint)]">{buildUrl()}</p>
      <span aria-live="polite" className="sr-only">{out ? `Request finished with status ${out.status}` : ''}</span>
      {out && (
        <>
          <p className="num mt-3 text-sm">
            <span className={out.status >= 200 && out.status < 300 ? '' : 'text-[var(--warn)]'}>{out.status || 'network error'}</span>
            <span className="text-[var(--faint)]">, {out.ms} ms, {(out.bytes / 1024).toFixed(1)} KB{out.body.length >= 6000 ? ', truncated to 6000 chars' : ''}</span>
          </p>
          <pre className="snippet mt-2 max-h-[420px] overflow-auto">{out.body}</pre>
        </>
      )}
    </div>
  );
}
