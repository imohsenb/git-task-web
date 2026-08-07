import { useSearchParams } from "react-router-dom";
import { useMemo, useCallback } from "react";
import type { LsFilters } from "./api";

/** Filters live in the query string — one source of truth, every board/list state
 * linkable, back/forward works. `q` is client-side search only, never sent to the
 * server (`ls` has no full-text filter). */
export interface TaskFiltersState extends LsFilters {
  q?: string;
}

export function useTaskFilters(): [TaskFiltersState, (next: Partial<TaskFiltersState>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<TaskFiltersState>(() => {
    const get = (key: string) => searchParams.get(key) ?? undefined;
    const getBool = (key: string) => (searchParams.has(key) ? searchParams.get(key) !== "false" : undefined);
    return {
      status: get("status"),
      assignee: get("assignee"),
      label: get("label"),
      kind: get("kind"),
      parent: get("parent"),
      mine: getBool("mine"),
      deleted: getBool("deleted"),
      q: get("q"),
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (next: Partial<TaskFiltersState>) => {
      setSearchParams(
        (prev) => {
          const usp = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(next)) {
            if (value === undefined || value === false || value === "") usp.delete(key);
            else usp.set(key, String(value));
          }
          return usp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [filters, setFilters];
}
