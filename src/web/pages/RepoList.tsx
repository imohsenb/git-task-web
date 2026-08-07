import { useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useRepoTasks } from "../lib/queries";
import { useTaskFilters } from "../lib/useTaskFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { filterTasksByQuery } from "../lib/filterTasks";
import { TaskListRow } from "../components/list/TaskListRow";
import { FilterBar } from "../components/list/FilterBar";
import { WarningStrip } from "../components/ui/WarningStrip";

export function RepoListPage() {
  const { repo = "" } = useParams();
  const [filters, setFilters] = useTaskFilters();
  const debouncedQuery = useDebouncedValue(filters.q ?? "", 150);

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
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {filteredTasks.map((task) => (
            <TaskListRow key={task.id} repo={repo} task={task} />
          ))}
        </div>
      )}

      <Outlet />
    </div>
  );
}
