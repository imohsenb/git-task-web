import { useAllTasks } from "../lib/queries";
import { TaskListRow } from "../components/list/TaskListRow";
import { WarningStrip } from "../components/ui/WarningStrip";
import type { TaskJson } from "../../shared/contract";

interface Row {
  repo: string;
  task: TaskJson;
}

function flatten(data: { data: { repos: { name: string; tasks: TaskJson[] }[] } } | undefined): Row[] {
  if (!data) return [];
  return data.data.repos.flatMap((r) => r.tasks.map((task) => ({ repo: r.name, task })));
}

export function Home() {
  const mineQuery = useAllTasks({ mine: true });
  const allQuery = useAllTasks({});

  const mineRows = flatten(mineQuery.data);
  const recentRows = [...flatten(allQuery.data)].sort((a, b) => b.task.updated - a.task.updated).slice(0, 10);

  return (
    <div className="space-y-8 px-8 py-6">
      <div>
        <h1 className="text-display font-display tracking-display text-ink-1">Home</h1>
        <p className="mt-1 text-ink-3">
          {allQuery.data ? `${allQuery.data.data.total} tasks across ${allQuery.data.data.repos.length} repos` : ""}
        </p>
      </div>

      {allQuery.data && <WarningStrip warnings={allQuery.data.warnings} />}

      <Section
        title="Assigned to me"
        loading={mineQuery.isLoading}
        error={mineQuery.error}
        rows={mineRows}
        empty="Nothing assigned to you."
      />
      <Section
        title="Recently updated"
        loading={allQuery.isLoading}
        error={allQuery.error}
        rows={recentRows}
        empty="No tasks yet — register a repo to get started."
      />
    </div>
  );
}

function Section({
  title,
  loading,
  error,
  rows,
  empty,
}: {
  title: string;
  loading: boolean;
  error: Error | null;
  rows: Row[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-4">{title}</h2>
      {loading && <p className="text-sm text-ink-4">Loading…</p>}
      {error && <p className="text-sm text-danger-ink">{error.message}</p>}
      {!loading && !error && rows.length === 0 && <p className="text-sm text-ink-4">{empty}</p>}
      {rows.length > 0 && (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map(({ repo, task }) => (
            <TaskListRow key={`${repo}-${task.id}`} repo={repo} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}
