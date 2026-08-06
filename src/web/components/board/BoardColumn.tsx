import { useDroppable } from "@dnd-kit/core";
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
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      data-board-column
      data-status={status}
      className={[
        "flex h-full min-w-[240px] max-w-[22rem] flex-1 flex-col rounded-well p-2.5 transition-colors",
        isOver ? "bg-brand-soft" : "bg-surface-sunk",
      ].join(" ")}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2 px-1">
        <Pill sem={semantic}>{status}</Pill>
        <span className="text-micro text-ink-4">{tasks.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            repo={repo}
            task={task}
            childCount={task.kind === "epic" ? childCounts.get(task.id) : undefined}
          />
        ))}
        {tasks.length === 0 && (
          <div
            className={[
              "flex h-16 items-center justify-center rounded-control border border-dashed text-micro text-ink-4",
              isOver ? "border-brand" : "border-line-strong",
            ].join(" ")}
          >
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
