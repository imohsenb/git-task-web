import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { GitPullRequest } from "lucide-react";
import { useAllTasks, useProjectPrs, useRegistry } from "../lib/queries";
import { useTaskFilters } from "../lib/useTaskFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { taskMatchesQuery } from "../lib/filterTasks";
import { usePageSize } from "../lib/pageSize";
import { TaskListRow } from "../components/list/TaskListRow";
import { FilterBar } from "../components/list/FilterBar";
import { WarningStrip } from "../components/ui/WarningStrip";
import { Breadcrumb } from "../components/shell/Breadcrumb";
import { PrRow } from "../components/prs/PrRow";

export function ProjectPage() {
  const { project = "" } = useParams();
  const [filters, setFilters] = useTaskFilters();
  const debouncedQuery = useDebouncedValue(filters.q ?? "", 150);
  const [pageSize] = usePageSize();
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const { data, isLoading, error } = useAllTasks({
    project,
    status: filters.status,
    assignee: filters.assignee,
    label: filters.label,
    kind: filters.kind,
    parent: filters.parent,
    mine: filters.mine,
    deleted: filters.deleted,
  });
  const { data: registry } = useRegistry();
  const { data: prsData } = useProjectPrs(project);

  const repoCount = registry?.data.repos.filter((r) => r.project === project).length ?? 0;
  const allRows = (data?.data.repos ?? []).flatMap((r) => r.tasks.map((task) => ({ repo: r.name, task })));
  const rows = useMemo(
    () => (debouncedQuery ? allRows.filter(({ task }) => taskMatchesQuery(task, debouncedQuery)) : allRows),
    [allRows, debouncedQuery],
  );

  // A narrower filter/search/page-size should restart pagination, not leave the
  // reveal count stranded from the previous, larger result set.
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [
    project,
    debouncedQuery,
    filters.status,
    filters.assignee,
    filters.label,
    filters.kind,
    filters.parent,
    filters.mine,
    filters.deleted,
    pageSize,
  ]);

  const visibleRows = rows.slice(0, visibleCount);
  const hiddenCount = rows.length - visibleRows.length;

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

      <div className="mt-4">
        <FilterBar filters={filters} setFilters={setFilters} statuses={data?.data.statuses ?? []} />
      </div>

      {isLoading && <p className="text-sm text-ink-4">Loading…</p>}
      {error && <p className="text-sm text-danger-ink">{error.message}</p>}
      {!isLoading && !error && rows.length === 0 && (
        <p className="text-sm text-ink-4">No tasks match the current filters.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="divide-y divide-line">
            {visibleRows.map(({ repo, task }) => (
              <TaskListRow key={`${repo}-${task.id}`} repo={repo} task={task} />
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + pageSize)}
              className="w-full border-t border-line py-2 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-sunk hover:text-ink-1"
            >
              Load {Math.min(hiddenCount, pageSize)} more ({hiddenCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
