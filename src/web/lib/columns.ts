import { statusSemantic, type Semantic } from "./status";

const DEFAULT_STATUS = "todo";

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
 * the current response. `pinned` (persisted `prefs.boards[repo].columns`)
 * lands with the settings backend in a later phase — until then every render
 * derives straight from the observed set, so a repo always shows a column
 * for every status its tasks actually use.
 *
 * `"todo"` (DEFAULT_STATUS) is pulled to the front when present; the rest are
 * grouped by status_semantic bucket, then alphabetically within a bucket.
 */
export function deriveColumns(statuses: string[]): BoardColumnDef[] {
  const rest = statuses
    .filter((status) => status !== DEFAULT_STATUS)
    .sort((a, b) => {
      const rankA = BUCKET_ORDER.indexOf(statusSemantic(a));
      const rankB = BUCKET_ORDER.indexOf(statusSemantic(b));
      return rankA !== rankB ? rankA - rankB : a.localeCompare(b);
    });
  const ordered = statuses.includes(DEFAULT_STATUS) ? [DEFAULT_STATUS, ...rest] : rest;
  return ordered.map((status) => ({ status, semantic: statusSemantic(status) }));
}
