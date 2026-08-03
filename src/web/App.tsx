import { useEffect, useState } from "react";

interface MetaResponse {
  name: string;
  version: string;
  mode: string;
}

export function App() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((res) => res.json())
      .then(setMeta)
      .catch((err) => setError(String(err)));
  }, []);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
      <div className="bg-shell rounded-shell shadow-shell max-w-md w-full p-10">
        <h1 className="text-display font-display tracking-display text-ink-1">
          git-task
        </h1>
        <p className="mt-2 text-ink-3">Local web interface, scaffold checkpoint.</p>

        <div className="mt-8 rounded-card bg-surface-sunk p-5">
          {error && <p className="text-danger-ink">{error}</p>}
          {!error && !meta && <p className="text-ink-4">Loading /api/meta…</p>}
          {meta && (
            <dl className="space-y-2 text-sm">
              <Row label="name" value={meta.name} />
              <Row label="version" value={meta.version} />
              <Row label="mode" value={meta.mode} />
            </dl>
          )}
        </div>

        <button
          type="button"
          className="mt-8 rounded-control bg-brand hover:bg-brand-hover text-white text-sm font-medium px-4 py-2 shadow-card transition-colors"
        >
          + Add new task
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-4 font-mono text-micro uppercase">{label}</dt>
      <dd className="text-ink-2 font-mono">{value}</dd>
    </div>
  );
}
