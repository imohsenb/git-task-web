import { useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useRepoTasks } from "../lib/queries";
import { useTaskFilters } from "../lib/useTaskFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { TaskListRow } from "../components/list/TaskListRow";
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

  const filteredTasks = useMemo(() => {
    if (!debouncedQuery) return tasks;
    const q = debouncedQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.display_id.toLowerCase().includes(q) ||
        t.labels.some((label) => label.toLowerCase().includes(q)),
    );
  }, [tasks, debouncedQuery]);

  return (
    <div className="px-8 py-5">
      {data && <WarningStrip warnings={data.warnings} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search this repo…"
          value={filters.q ?? ""}
          onChange={(e) => setFilters({ q: e.target.value })}
          className="w-64 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink-1 placeholder:text-ink-4 focus:border-brand focus:outline-none"
        />
        <select
          value={filters.status ?? ""}
          onChange={(e) => setFilters({ status: e.target.value || undefined })}
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink-2"
        >
          <option value="">All statuses</option>
          {(data?.data.statuses ?? []).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink-3">
          <input
            type="checkbox"
            checked={!!filters.mine}
            onChange={(e) => setFilters({ mine: e.target.checked || undefined })}
          />
          Assigned to me
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink-3">
          <input
            type="checkbox"
            checked={!!filters.deleted}
            onChange={(e) => setFilters({ deleted: e.target.checked || undefined })}
          />
          Show deleted
        </label>
      </div>

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
