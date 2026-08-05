import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Folder, GitBranch, Plus } from "lucide-react";
import { useRegistry } from "../../lib/queries";
import { AddRepoDialog } from "../repo/AddRepoDialog";

export function Sidebar() {
  const { data, isLoading, error } = useRegistry();
  const [showAddRepo, setShowAddRepo] = useState(false);

  return (
    <nav className="w-[268px] shrink-0 border-r border-line bg-shell flex flex-col">
      <div className="h-[64px] flex items-center justify-between px-5">
        <span className="text-lg font-display font-display tracking-display text-ink-1">git-task</span>
        <button
          type="button"
          onClick={() => setShowAddRepo(true)}
          aria-label="Add a repo"
          title="Add a repo"
          className="rounded-control p-1 text-ink-4 transition-colors hover:bg-surface-sunk hover:text-ink-1"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        {isLoading && <p className="px-2 text-sm text-ink-4">Loading…</p>}
        {error && <p className="px-2 text-sm text-danger-ink">{error.message}</p>}
        {data &&
          groupByProject(data.data.repos).map(([project, repos]) => (
            <div key={project || "(no project)"}>
              {project ? (
                <Link
                  to={`/p/${encodeURIComponent(project)}`}
                  className="flex items-center gap-1.5 rounded-control px-2 py-1 text-micro font-medium uppercase tracking-wide text-ink-4 transition-colors hover:text-ink-2"
                >
                  <Folder size={12} strokeWidth={2.5} />
                  <span>{project}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 text-micro font-medium uppercase tracking-wide text-ink-4">
                  <Folder size={12} strokeWidth={2.5} />
                  <span>Ungrouped</span>
                </div>
              )}
              <ul>
                {repos.map((repo) => (
                  <li key={repo.name}>
                    <NavLink
                      to={`/r/${encodeURIComponent(repo.name)}/list`}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-2 rounded-control px-2 py-1.5 text-sm transition-colors",
                          isActive ? "bg-brand-soft text-brand-ink font-medium" : "text-ink-2 hover:bg-surface-sunk",
                        ].join(" ")
                      }
                    >
                      <GitBranch size={14} strokeWidth={2} className="shrink-0 text-ink-4" />
                      <span className="truncate">{repo.name}</span>
                      {repo.openable === false && (
                        <span className="ml-auto size-1.5 rounded-pill bg-danger-ink" title={repo.error ?? "unreachable"} />
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      {showAddRepo && <AddRepoDialog onClose={() => setShowAddRepo(false)} />}
    </nav>
  );
}

function groupByProject<T extends { project: string }>(repos: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const repo of repos) {
    const list = groups.get(repo.project);
    if (list) list.push(repo);
    else groups.set(repo.project, [repo]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
