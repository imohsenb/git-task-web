import { useParams } from "react-router-dom";
import { GitPullRequest } from "lucide-react";
import { useAllTasks, useProjectPrs, useRegistry } from "../lib/queries";
import { TaskListRow } from "../components/list/TaskListRow";
import { WarningStrip } from "../components/ui/WarningStrip";
import { Breadcrumb } from "../components/shell/Breadcrumb";
import { PrRow } from "../components/prs/PrRow";

export function ProjectPage() {
  const { project = "" } = useParams();
  const { data, isLoading, error } = useAllTasks({ project });
  const { data: registry } = useRegistry();
  const { data: prsData } = useProjectPrs(project);

  const repoCount = registry?.data.repos.filter((r) => r.project === project).length ?? 0;
  const rows = (data?.data.repos ?? []).flatMap((r) => r.tasks.map((task) => ({ repo: r.name, task })));

  const prRepos = (prsData?.data.repos ?? []).filter((r) => r.providerName);
  const totalOpenPrs = prRepos.reduce((sum, r) => sum + r.prs.length, 0);

  return (
    <div className="px-8 py-6">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: project }]} />
      <h1 className="mt-3 text-display font-display tracking-display text-ink-1">{project}</h1>
      <p className="mt-2 text-sm text-ink-3">
        {repoCount} repo{repoCount === 1 ? "" : "s"}
        {data ? ` · ${data.data.total} tasks` : ""} · read-only aggregate across repos — open a repo's own board to
        drag between statuses
      </p>

      {data && <WarningStrip warnings={data.warnings} />}

      {prRepos.length > 0 && (
        <details className="mt-4 rounded-card border border-line bg-surface" open>
          <summary className="flex cursor-pointer select-none items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-ink-1">
            <GitPullRequest size={14} className="text-ink-3" />
            Open pull requests ({totalOpenPrs})
          </summary>
          <div className="border-t border-line p-3">
            {totalOpenPrs === 0 ? (
              <p className="text-sm text-ink-4">No open pull requests across registered repos.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {prRepos.flatMap((r) => r.prs.map((pr) => <PrRow key={`${r.repo}-${pr.id}`} pr={pr} repoLabel={r.repo} />))}
              </ul>
            )}
          </div>
        </details>
      )}

      {isLoading && <p className="mt-4 text-sm text-ink-4">Loading…</p>}
      {error && <p className="mt-4 text-sm text-danger-ink">{error.message}</p>}
      {!isLoading && !error && rows.length === 0 && (
        <p className="mt-4 text-sm text-ink-4">No tasks in this project.</p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map(({ repo, task }) => (
            <TaskListRow key={`${repo}-${task.id}`} repo={repo} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
