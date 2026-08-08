import type { TaskJson } from "../../shared/contract";

export function taskMatchesQuery(task: TaskJson, query: string): boolean {
  const q = query.toLowerCase();
  return (
    task.title.toLowerCase().includes(q) ||
    task.description.toLowerCase().includes(q) ||
    task.display_id.toLowerCase().includes(q) ||
    task.labels.some((label) => label.toLowerCase().includes(q))
  );
}

/** Client-side substring search over the loaded set — `ls` has no full-text filter (§4.5). */
export function filterTasksByQuery(tasks: TaskJson[], query: string): TaskJson[] {
  if (!query) return tasks;
  return tasks.filter((t) => taskMatchesQuery(t, query));
}
