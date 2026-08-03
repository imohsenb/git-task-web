import type { TaskFiltersState } from "../../lib/useTaskFilters";

export function FilterBar({
  filters,
  setFilters,
  statuses,
  showStatusFilter = true,
  searchPlaceholder = "Search…",
}: {
  filters: TaskFiltersState;
  setFilters: (next: Partial<TaskFiltersState>) => void;
  statuses: string[];
  /** Board hides this — its columns already segment by status, so a status
   * dropdown would just collapse the board to one column. */
  showStatusFilter?: boolean;
  searchPlaceholder?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        type="search"
        placeholder={searchPlaceholder}
        value={filters.q ?? ""}
        onChange={(e) => setFilters({ q: e.target.value })}
        className="w-64 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink-1 placeholder:text-ink-4 focus:border-brand focus:outline-none"
      />
      {showStatusFilter && (
        <select
          value={filters.status ?? ""}
          onChange={(e) => setFilters({ status: e.target.value || undefined })}
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink-2"
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-1.5 text-sm text-ink-3">
        <input
          type="checkbox"
          checked={!!filters.mine}
          onChange={(e) => setFilters({ mine: e.target.checked || undefined })}
        />
        Assigned to me
      </label>
      <label className="flex items-center gap-1.5 text-sm text-ink-3">
        <input
          type="checkbox"
          checked={!!filters.deleted}
          onChange={(e) => setFilters({ deleted: e.target.checked || undefined })}
        />
        Show deleted
      </label>
    </div>
  );
}
