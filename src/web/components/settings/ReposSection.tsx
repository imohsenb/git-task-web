import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { useRegistry } from "../../lib/queries";
import { useMoveRepoProject, useSyncAll, useUnregisterRepo } from "../../lib/mutations";
import { AddRepoDialog } from "../repo/AddRepoDialog";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import type { RegistryRepoJson, SyncItemResult } from "../../../shared/contract";

export function ReposSection() {
  const { data: registry } = useRegistry();
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [unregisterTarget, setUnregisterTarget] = useState<RegistryRepoJson | null>(null);
  const [lastSync, setLastSync] = useState<SyncItemResult[] | null>(null);
  const unregisterRepo = useUnregisterRepo();
  const syncAll = useSyncAll();

  const repos = registry?.data.repos ?? [];
  const projects = registry?.data.projects ?? [];
  const syncableRepos = repos.filter((r) => (r.remotes?.length ?? 0) > 0).map((r) => r.name);

  function runSyncAll(op: "push" | "pull") {
    syncAll.mutate(
      { repos: syncableRepos, op },
      {
        onSuccess: (result) => {
          if (!result) return;
          setLastSync(result.data.results);
          const failed = result.data.results.filter((r) => !r.ok).length;
          const verb = op === "push" ? "Pushed" : "Pulled";
          if (failed === 0) toast.success(`${verb} ${result.data.results.length} repo(s)`);
          else toast.warning(`${verb}: ${result.data.results.length - failed} ok, ${failed} failed`);
        },
      },
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-4">Repos</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => runSyncAll("pull")}
            disabled={syncAll.isPending || syncableRepos.length === 0}
            title={syncableRepos.length === 0 ? "No registered repo has a remote configured" : "Pull every repo"}
            className="flex items-center gap-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-sunk disabled:opacity-50"
          >
            <ArrowDown size={14} /> Pull all
          </button>
          <button
            type="button"
            onClick={() => runSyncAll("push")}
            disabled={syncAll.isPending || syncableRepos.length === 0}
            title={syncableRepos.length === 0 ? "No registered repo has a remote configured" : "Push every repo"}
            className="flex items-center gap-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-sunk disabled:opacity-50"
          >
            <ArrowUp size={14} /> Push all
          </button>
          <button
            type="button"
            onClick={() => setShowAddRepo(true)}
            className="flex items-center gap-1 rounded-control bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <Plus size={14} /> Add repo
          </button>
        </div>
      </div>

      {lastSync && (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface text-sm">
          {lastSync.map((item) => (
            <li key={item.repo} className="flex items-center gap-2 px-3 py-1.5">
              <span className={item.ok ? "text-success-ink" : "text-danger-ink"}>{item.ok ? "✓" : "✕"}</span>
              <span className="text-ink-2">{item.repo}</span>
              {!item.ok && item.error && <span className="truncate text-micro text-ink-4">{item.error.message}</span>}
            </li>
          ))}
        </ul>
      )}

      {repos.length === 0 ? (
        <p className="mt-3 text-sm text-ink-4">No repos registered yet.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-card border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunk text-micro uppercase tracking-wide text-ink-4">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Path</th>
                <th className="px-3 py-2 text-left font-medium">Project</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {repos.map((repo) => (
                <RepoRow
                  key={repo.name}
                  repo={repo}
                  projects={projects}
                  onUnregister={() => setUnregisterTarget(repo)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddRepo && <AddRepoDialog onClose={() => setShowAddRepo(false)} />}

      {unregisterTarget && (
        <ConfirmDialog
          title={`Unregister '${unregisterTarget.name}'?`}
          body={
            <>
              Removes it from the registry only — the repo itself, and every task in it, is untouched on disk at{" "}
              <span className="font-mono text-ink-2">{unregisterTarget.path}</span>. Re-register it any time to
              bring it back.
            </>
          }
          confirmLabel="Unregister"
          onConfirm={() =>
            unregisterRepo.mutate(unregisterTarget.name, { onSettled: () => setUnregisterTarget(null) })
          }
          onCancel={() => setUnregisterTarget(null)}
          busy={unregisterRepo.isPending}
        />
      )}
    </section>
  );
}

function RepoRow({
  repo,
  projects,
  onUnregister,
}: {
  repo: RegistryRepoJson;
  projects: string[];
  onUnregister: () => void;
}) {
  const moveProject = useMoveRepoProject(repo.name);
  const projectChoices = projects.includes(repo.project) ? projects : [repo.project, ...projects];

  return (
    <tr>
      <td className="px-3 py-2">
        <Link to={`/r/${encodeURIComponent(repo.name)}`} className="font-medium text-ink-1 hover:text-brand-ink">
          {repo.name}
        </Link>
        {repo.openable === false && (
          <span className="ml-2 inline-flex items-center gap-1 text-micro text-danger-ink" title={repo.error ?? "unreachable"}>
            <AlertTriangle size={12} /> unreachable
          </span>
        )}
      </td>
      <td className="max-w-xs truncate px-3 py-2 font-mono text-micro text-ink-3" title={repo.path}>
        {repo.path}
      </td>
      <td className="px-3 py-2">
        <select
          value={repo.project}
          onChange={(e) => moveProject.mutate(e.target.value)}
          disabled={moveProject.isPending}
          className="rounded-control border border-line bg-surface px-2 py-1 text-micro text-ink-1"
        >
          {projectChoices.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={onUnregister}
          className="text-ink-4 hover:text-danger-ink"
          aria-label={`Unregister ${repo.name}`}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
