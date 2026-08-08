import { useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Breadcrumb } from "../components/shell/Breadcrumb";
import { MetaBlock } from "../components/meta/MetaBlock";
import { NewTaskDialog } from "../components/task/NewTaskDialog";
import { useRegistry } from "../lib/queries";
import { useNewTaskShortcut } from "../lib/keyboard";
import { repoWebUrl } from "../lib/repoUrl";

const TABS = [
  { view: "board", label: "Board" },
  { view: "list", label: "List" },
  { view: "table", label: "Table" },
  { view: "milestones", label: "Milestones" },
  { view: "members", label: "Members" },
  { view: "development", label: "Development" },
  { view: "sync", label: "Sync" },
] as const;

export function RepoWorkspace() {
  const { repo = "" } = useParams();
  const { data } = useRegistry();
  const repoEntry = data?.data.repos.find((r) => r.name === repo);
  const webUrl = repoWebUrl(repoEntry?.remotes);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  useNewTaskShortcut(() => setIsNewTaskOpen(true));

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-8 pt-6">
        <Breadcrumb
          items={[
            { label: "Home", to: "/" },
            ...(repoEntry?.project ? [{ label: repoEntry.project, to: `/p/${encodeURIComponent(repoEntry.project)}` }] : []),
            { label: repo },
          ]}
        />
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-display font-display tracking-display text-ink-1">{repo}</h1>
          {webUrl && (
            <a
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open repository"
              aria-label="Open repository"
              className="text-ink-4 transition-colors hover:text-ink-1"
            >
              <ExternalLink size={18} />
            </a>
          )}
        </div>
        <MetaBlock
          repoKey={repoEntry?.key ?? null}
          branch={repoEntry?.branch ?? null}
          taskCount={repoEntry?.task_count ?? null}
        />
      </div>

      <div className="mt-5 flex shrink-0 items-center gap-1 border-b border-line px-8">
        {TABS.map((tab) => (
          <NavLink
            key={tab.view}
            to={`/r/${encodeURIComponent(repo)}/${tab.view}`}
            className={({ isActive }) =>
              [
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "border-brand text-brand-ink" : "border-transparent text-ink-3 hover:text-ink-1",
              ].join(" ")
            }
          >
            {tab.label}
          </NavLink>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setIsNewTaskOpen(true)}
          className="mb-2 rounded-control bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          + Add new task
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {isNewTaskOpen && <NewTaskDialog repo={repo} onClose={() => setIsNewTaskOpen(false)} />}
    </div>
  );
}
