import { useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import type { TaskJson } from "../../shared/contract";
import { useRepoTasks } from "../lib/queries";
import { useTaskFilters } from "../lib/useTaskFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { filterTasksByQuery } from "../lib/filterTasks";
import { deriveColumns } from "../lib/columns";
import { childCountByParent } from "../lib/childCounts";
import { FilterBar } from "../components/list/FilterBar";
import { BoardColumn } from "../components/board/BoardColumn";
import { WarningStrip } from "../components/ui/WarningStrip";

function groupByStatus(tasks: TaskJson[]): Map<string, TaskJson[]> {
  const map = new Map<string, TaskJson[]>();
  for (const task of tasks) {
    const list = map.get(task.status);
    if (list) list.push(task);
    else map.set(task.status, [task]);
  }
  return map;
}

export function RepoBoardPage() {
  const { repo = "" } = useParams();
  const [filters, setFilters] = useTaskFilters();
  const debouncedQuery = useDebouncedValue(filters.q ?? "", 150);

  // No `status` filter here — the board's columns already segment by status.
  const { data, isLoading, error } = useRepoTasks(repo, {
    assignee: filters.assignee,
    label: filters.label,
    kind: filters.kind,
    parent: filters.parent,
    mine: filters.mine,
    deleted: filters.deleted,
  });

  const tasks = data?.data.repos[0]?.tasks ?? [];
  const filteredTasks = useMemo(() => filterTasksByQuery(tasks, debouncedQuery), [tasks, debouncedQuery]);
  const columns = useMemo(() => deriveColumns(data?.data.statuses ?? []), [data?.data.statuses]);
  const childCounts = useMemo(() => childCountByParent(filteredTasks), [filteredTasks]);
  const byStatus = useMemo(() => groupByStatus(filteredTasks), [filteredTasks]);

  return (
    <div className="px-8 py-5">
      {data && <WarningStrip warnings={data.warnings} />}

      <FilterBar filters={filters} setFilters={setFilters} statuses={[]} showStatusFilter={false} />

      {isLoading && <p className="text-sm text-ink-4">Loading tasks…</p>}
      {error && <p className="text-sm text-danger-ink">{error.message}</p>}
      {!isLoading && !error && columns.length === 0 && (
        <p className="text-sm text-ink-4">No tasks match the current filters.</p>
      )}

      {columns.length > 0 && (
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <BoardColumn
              key={col.status}
              repo={repo}
              status={col.status}
              semantic={col.semantic}
              tasks={byStatus.get(col.status) ?? []}
              childCounts={childCounts}
            />
          ))}
        </div>
      )}

      <Outlet />
    </div>
  );
}
