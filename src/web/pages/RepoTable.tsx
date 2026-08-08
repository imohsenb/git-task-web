import { useMemo, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import type { TaskJson } from "../../shared/contract";
import { useRepoTasks } from "../lib/queries";
import { useTaskFilters } from "../lib/useTaskFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { filterTasksByQuery, sortTasksByUpdatedDesc } from "../lib/filterTasks";
import { FilterBar } from "../components/list/FilterBar";
import { WarningStrip } from "../components/ui/WarningStrip";
import { Pill } from "../components/ui/Pill";
import { kindSemantic, prioritySemantic, statusSemantic } from "../lib/status";

const columnHelper = createColumnHelper<TaskJson>();

const columns = [
  columnHelper.accessor("kind", {
    header: "Kind",
    cell: (info) => <Pill sem={kindSemantic(info.getValue())}>{info.getValue()}</Pill>,
  }),
  columnHelper.accessor("display_id", {
    header: "ID",
    cell: (info) => <span className="font-mono text-micro text-ink-4">{info.getValue()}</span>,
  }),
  columnHelper.accessor("title", {
    header: "Title",
    cell: (info) => {
      const task = info.row.original;
      return (
        <span className={["text-sm font-medium text-ink-1", task.deleted ? "line-through" : ""].join(" ")}>
          {info.getValue()}
        </span>
      );
    },
  }),
  columnHelper.accessor("priority", {
    header: "Priority",
    cell: (info) => {
      const priority = info.getValue();
      return priority ? <Pill sem={prioritySemantic(priority)}>{priority}</Pill> : null;
    },
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <Pill sem={statusSemantic(info.getValue())}>{info.getValue()}</Pill>,
  }),
];

export function RepoTablePage() {
  const { repo = "" } = useParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useTaskFilters();
  const debouncedQuery = useDebouncedValue(filters.q ?? "", 150);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data, isLoading, error } = useRepoTasks(repo, {
    status: filters.status,
    assignee: filters.assignee,
    label: filters.label,
    kind: filters.kind,
    parent: filters.parent,
    mine: filters.mine,
    deleted: filters.deleted,
  });

  const tasks = data?.data.repos[0]?.tasks ?? [];
  // Sorted newest-first as the base order; clicking a header (`sorting` state)
  // overrides it via getSortedRowModel.
  const filteredTasks = useMemo(
    () => sortTasksByUpdatedDesc(filterTasksByQuery(tasks, debouncedQuery)),
    [tasks, debouncedQuery],
  );

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (task) => task.id,
  });

  const openTask = (displayId: string) => navigate(`/r/${encodeURIComponent(repo)}/table/t/${encodeURIComponent(displayId)}`);

  return (
    <div className="px-8 py-5">
      {data && <WarningStrip warnings={data.warnings} />}

      <FilterBar filters={filters} setFilters={setFilters} statuses={data?.data.statuses ?? []} />

      {isLoading && <p className="text-sm text-ink-4">Loading tasks…</p>}
      {error && <p className="text-sm text-danger-ink">{error.message}</p>}
      {!isLoading && !error && filteredTasks.length === 0 && (
        <p className="text-sm text-ink-4">No tasks match the current filters.</p>
      )}

      {filteredTasks.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full border-collapse text-left">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-line">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-2 text-micro font-medium uppercase tracking-wide text-ink-4"
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && <ArrowUpDown size={11} />}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-line">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => openTask(row.original.display_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openTask(row.original.display_id);
                    }
                  }}
                  className={[
                    "cursor-pointer transition-colors hover:bg-surface-sunk",
                    row.original.deleted ? "opacity-55" : "",
                  ].join(" ")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Outlet />
    </div>
  );
}
