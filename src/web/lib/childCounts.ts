import type { TaskJson } from "../../shared/contract";

/**
 * §4.3: an epic's card shows a child count alongside its link count. The CLI
 * has no reverse parent→children index, so it's derived here from whatever
 * task set is currently loaded (a single repo's `ls` response).
 */
export function childCountByParent(tasks: TaskJson[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.parent) continue;
    counts.set(task.parent, (counts.get(task.parent) ?? 0) + 1);
  }
  return counts;
}
