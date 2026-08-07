import { useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import type { TaskJson } from "../../shared/contract";
import { useRepoTasks } from "../lib/queries";
import { useTaskFilters } from "../lib/useTaskFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { filterTasksByQuery } from "../lib/filterTasks";
import { TaskListRow } from "../components/list/TaskListRow";
import { FilterBar } from "../components/list/FilterBar";
import { WarningStrip } from "../components/ui/WarningStrip";

const NO_MILESTONE = Symbol("no-milestone");

function groupByMilestone(tasks: TaskJson[]): [string | typeof NO_MILESTONE, TaskJson[]][] {
  const groups = new Map<string | typeof NO_MILESTONE, TaskJson[]>();
  for (const task of tasks) {
    const key = task.milestone ?? NO_MILESTONE;
    const list = groups.get(key);
    if (list) list.push(task);
    else groups.set(key, [task]);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === NO_MILESTONE) return 1;
    if (b === NO_MILESTONE) return -1;
    return (a as string).localeCompare(b as string);
  });
}

/** Honest substitution for the reference's calendar nav (§4.3) — `due` is opaque,
 * so there is no real timeline, but `milestone` is a free-text label git-task
 * already tracks per task, so grouping by it is the closest real equivalent. */
export function RepoMilestonesPage() {
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
  const groups = useMemo(() => groupByMilestone(filteredTasks), [filteredTasks]);

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
      {!isLoading && !error && groups.length === 0 && (
        <p className="text-sm text-ink-4">No tasks match the current filters.</p>
      )}

      <div className="space-y-6">
        {groups.map(([milestone, groupTasks]) => (
          <section key={typeof milestone === "string" ? milestone : "__none__"}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-4">
              {milestone === NO_MILESTONE ? "No milestone" : milestone}
              <span className="font-normal normal-case text-ink-4">({groupTasks.length})</span>
            </h2>
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {groupTasks.map((task) => (
                <TaskListRow key={task.id} repo={repo} task={task} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
