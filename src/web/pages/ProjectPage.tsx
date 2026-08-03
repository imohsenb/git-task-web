import { useParams } from "react-router-dom";
import { useAllTasks, useRegistry } from "../lib/queries";
import { TaskListRow } from "../components/list/TaskListRow";
import { WarningStrip } from "../components/ui/WarningStrip";
import { Breadcrumb } from "../components/shell/Breadcrumb";

export function ProjectPage() {
  const { project = "" } = useParams();
  const { data, isLoading, error } = useAllTasks({ project });
  const { data: registry } = useRegistry();

  const repoCount = registry?.data.repos.filter((r) => r.project === project).length ?? 0;
  const rows = (data?.data.repos ?? []).flatMap((r) => r.tasks.map((task) => ({ repo: r.name, task })));

  return (
    <div className="px-8 py-6">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: project }]} />
      <h1 className="mt-3 text-display font-display tracking-display text-ink-1">{project}</h1>
      <p className="mt-2 text-sm text-ink-3">
        {repoCount} repo{repoCount === 1 ? "" : "s"}
        {data ? ` · ${data.data.total} tasks` : ""} · read-only aggregate — drag lands with Board in Phase 3
      </p>

      {data && <WarningStrip warnings={data.warnings} />}

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
