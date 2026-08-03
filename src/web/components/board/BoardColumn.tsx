import type { TaskJson } from "../../../shared/contract";
import type { Semantic } from "../../lib/status";
import { Pill } from "../ui/Pill";
import { TaskCard } from "./TaskCard";

export function BoardColumn({
  repo,
  status,
  semantic,
  tasks,
  childCounts,
}: {
  repo: string;
  status: string;
  semantic: Semantic;
  tasks: TaskJson[];
  childCounts: Map<string, number>;
}) {
  return (
    <div className="w-column shrink-0 rounded-well bg-surface-sunk p-2.5">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Pill sem={semantic}>{status}</Pill>
        <span className="text-micro text-ink-4">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            repo={repo}
            task={task}
            childCount={task.kind === "epic" ? childCounts.get(task.id) : undefined}
          />
        ))}
        {tasks.length === 0 && <p className="px-1 py-2 text-micro text-ink-4">No tasks</p>}
      </div>
    </div>
  );
}
