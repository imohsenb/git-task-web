import { useEffect, useMemo, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useRepoTasks } from "../lib/queries";
import { useTaskFilters } from "../lib/useTaskFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { filterTasksByQuery } from "../lib/filterTasks";
import { usePageSize } from "../lib/pageSize";
import { TaskListRow } from "../components/list/TaskListRow";
import { FilterBar } from "../components/list/FilterBar";
import { WarningStrip } from "../components/ui/WarningStrip";

export function RepoListPage() {
  const { repo = "" } = useParams();
  const [filters, setFilters] = useTaskFilters();
  const debouncedQuery = useDebouncedValue(filters.q ?? "", 150);
  const [pageSize] = usePageSize();
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const { data, isLoading, error } = useRepoTasks(repo, {
    status: filters.status,
    assignee: filters.assignee,
    label: filters.label,
    kind: filters.kind,
    parent: filters.parent,
    mine: filters.mine,
    deleted: filters.deleted,
  });

  const tasks = data?.data.repos[0]?.tasks ?? [];
  const filteredTasks = useMemo(() => filterTasksByQuery(tasks, debouncedQuery), [tasks, debouncedQuery]);

  // A narrower filter/search/page-size should restart pagination, not leave the
  // reveal count stranded from the previous, larger result set.
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [
    repo,
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

  const visibleTasks = filteredTasks.slice(0, visibleCount);
  const hiddenCount = filteredTasks.length - visibleTasks.length;

  return (
    <div className="px-8 py-5">
      {data && <WarningStrip warnings={data.warnings} />}

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        statuses={data?.data.statuses ?? []}
        searchPlaceholder="Search this repo…"
      />

      {isLoading && <p className="text-sm text-ink-4">Loading tasks…</p>}
      {error && <p className="text-sm text-danger-ink">{error.message}</p>}
      {!isLoading && !error && filteredTasks.length === 0 && (
        <p className="text-sm text-ink-4">No tasks match the current filters.</p>
      )}

      {filteredTasks.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="divide-y divide-line">
            {visibleTasks.map((task) => (
              <TaskListRow key={task.id} repo={repo} task={task} />
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

      <Outlet />
    </div>
  );
}
