import type { TaskJson } from "../../shared/contract";

/** Client-side substring search over the loaded set — `ls` has no full-text filter (§4.5). */
export function filterTasksByQuery(tasks: TaskJson[], query: string): TaskJson[] {
  if (!query) return tasks;
  const q = query.toLowerCase();
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.display_id.toLowerCase().includes(q) ||
      t.labels.some((label) => label.toLowerCase().includes(q)),
  );
}
