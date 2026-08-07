import { statusSemantic, type Semantic } from "./status";

const DEFAULT_STATUS = "todo";

/**
 * Ground-truth default workflow: git-task's own `edit.rs::STATUS_PRESETS`
 * (`&["todo", "doing", "blocked", "done"]`, offered as suggestions when setting a
 * status). Used here as always-pinned columns so a sparse or brand-new repo still
 * renders a real board shape ("column per status, like Jira") instead of collapsing
 * to just whatever one status its handful of tasks happen to use. A repo on a
 * different workflow keeps all of its real statuses too — this only ever adds
 * empty columns, never hides an observed one.
 */
const DEFAULT_COLUMNS = ["todo", "doing", "blocked", "done"];

/**
 * Bucket rank exactly as specified in PLAN.md §4.4 — info, then neutral, then
 * warn, danger, success. Neutral (the catch-all for a status status_semantic
 * doesn't recognize) sits second on purpose: a freshly invented status like
 * `git task status X shipped` lands right after the "not started" bucket
 * instead of being buried at the end.
 */
const BUCKET_ORDER: Semantic[] = ["info", "neutral", "warn", "danger", "success"];

export interface BoardColumnDef {
  status: string;
  semantic: Semantic;
}

/**
 * Ground truth #8: `columns = ordered(union(pinned, observed))`. `observed`
 * is `LsJson.statuses`, already scoped by the CLI to whatever tasks are in
 * the current response. `pinned` is DEFAULT_COLUMNS above until persisted
 * `prefs.boards[repo].columns` lands with the settings backend in a later phase.
 *
 * `"todo"` (DEFAULT_STATUS) is pulled to the front when present; the rest are
 * grouped by status_semantic bucket, then alphabetically within a bucket.
 */
export function deriveColumns(statuses: string[]): BoardColumnDef[] {
  const union = [...new Set([...DEFAULT_COLUMNS, ...statuses])];
  const rest = union
    .filter((status) => status !== DEFAULT_STATUS)
    .sort((a, b) => {
      const rankA = BUCKET_ORDER.indexOf(statusSemantic(a));
      const rankB = BUCKET_ORDER.indexOf(statusSemantic(b));
      return rankA !== rankB ? rankA - rankB : a.localeCompare(b);
    });
  const ordered = union.includes(DEFAULT_STATUS) ? [DEFAULT_STATUS, ...rest] : rest;
  return ordered.map((status) => ({ status, semantic: statusSemantic(status) }));
}
