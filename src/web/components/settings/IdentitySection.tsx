import { AlertTriangle, Check } from "lucide-react";
import { useMeta, useRegistry } from "../../lib/queries";
import type { IdentityInfoJson } from "../../../shared/contract";

/**
 * §3.2: identity is resolved by git itself from the server process's environment —
 * there is no editor here, only a read-out of what each repo would commit as, so a
 * surprising attribution is caught before a write rather than after. Per-repo rows
 * come straight from `repos --deep`'s `identity` field (already fetched by
 * useRegistry — no extra request needed).
 */
export function IdentitySection() {
  const { data: meta } = useMeta();
  const { data: registry } = useRegistry();

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-4">Identity</h2>
      <p className="mt-1 text-sm text-ink-3">
        git-task-web never supplies or overrides who a write is attributed to — every commit uses whatever git
        resolves for the server process. To change it, run <code className="font-mono text-ink-2">git config</code>{" "}
        in the relevant repo (or --global for everywhere).
      </p>

      {meta && (
        <div className="mt-3 rounded-card border border-line bg-surface p-3">
          <p className="mb-1 text-micro uppercase tracking-wide text-ink-4">Default (outside any repo)</p>
          <IdentityRow identity={meta.data.identity} />
        </div>
      )}

      {registry && registry.data.repos.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-card border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunk text-micro uppercase tracking-wide text-ink-4">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Repo</th>
                <th className="px-3 py-2 text-left font-medium">Committing as</th>
                <th className="px-3 py-2 text-left font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {registry.data.repos.map((repo) => (
                <tr key={repo.name}>
                  <td className="px-3 py-2 text-ink-2">{repo.name}</td>
                  <td className="px-3 py-2">
                    {repo.identity ? <IdentityRow identity={repo.identity} compact /> : <span className="text-ink-4">—</span>}
                  </td>
                  <td className="px-3 py-2 text-ink-3">{repo.identity?.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function IdentityRow({ identity, compact }: { identity: IdentityInfoJson; compact?: boolean }) {
  if (!identity.ok) {
    return (
      <span className="flex items-center gap-1.5 text-danger-ink">
        <AlertTriangle size={14} />
        Not configured
      </span>
    );
  }
  return (
    <span className={compact ? "text-ink-2" : "flex items-center gap-1.5 text-ink-1"}>
      {!compact && <Check size={14} className="text-success-ink" />}
      {identity.name} <span className="text-ink-4">&lt;{identity.email}&gt;</span>
      {!compact && <span className="ml-1 text-micro text-ink-4">via {identity.source}</span>}
    </span>
  );
}
