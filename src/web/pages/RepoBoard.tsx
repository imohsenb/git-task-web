import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { TaskJson } from "../../shared/contract";
import { useRepoTasks } from "../lib/queries";
import { useSetStatus } from "../lib/mutations";
import { useTaskFilters } from "../lib/useTaskFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { filterTasksByQuery, sortTasksByUpdatedDesc } from "../lib/filterTasks";
import { deriveColumns } from "../lib/columns";
import { childCountByParent } from "../lib/childCounts";
import { FilterBar } from "../components/list/FilterBar";
import { BoardColumn } from "../components/board/BoardColumn";
import { TaskCardGhost } from "../components/board/TaskCard";
import { WarningStrip } from "../components/ui/WarningStrip";

function groupByStatus(tasks: TaskJson[]): Map<string, TaskJson[]> {
  const map = new Map<string, TaskJson[]>();
  for (const task of tasks) {
    const list = map.get(task.status);
    if (list) list.push(task);
    else map.set(task.status, [task]);
  }
  return map;
}

interface DragPayload {
  displayId: string;
  status: string;
}

export function RepoBoardPage() {
  const { repo = "" } = useParams();
  const [filters, setFilters] = useTaskFilters();
  const debouncedQuery = useDebouncedValue(filters.q ?? "", 150);
  const queryClient = useQueryClient();
  const setStatus = useSetStatus(repo);
  const [activeId, setActiveId] = useState<string | null>(null);

  // No `status` filter here — the board's columns already segment by status.
  const { data, isLoading, error } = useRepoTasks(repo, {
    assignee: filters.assignee,
    label: filters.label,
    kind: filters.kind,
    parent: filters.parent,
    mine: filters.mine,
    deleted: filters.deleted,
  });

  const tasks = data?.data.repos[0]?.tasks ?? [];
  const filteredTasks = useMemo(() => filterTasksByQuery(tasks, debouncedQuery), [tasks, debouncedQuery]);
  const columns = useMemo(() => deriveColumns(data?.data.statuses ?? []), [data?.data.statuses]);
  const childCounts = useMemo(() => childCountByParent(filteredTasks), [filteredTasks]);
  const byStatus = useMemo(() => groupByStatus(sortTasksByUpdatedDesc(filteredTasks)), [filteredTasks]);
  const activeTask = activeId ? filteredTasks.find((t) => t.id === activeId) : undefined;

  // 8px activation distance so a plain click still opens the task dialog instead of
  // always starting a drag (§4.4 "onDragStart cancels in-flight refetches").
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // Screen-reader announcements for keyboard/pointer drag — dnd-kit's default
  // wording just reads back raw ids, which means nothing without the task/column
  // context sighted users get for free from the card and the column header.
  const announcements: Announcements = useMemo(() => {
    const describe = (id: string) => filteredTasks.find((t) => t.id === id);
    return {
      onDragStart({ active }) {
        const task = describe(active.id as string);
        return task ? `Picked up task ${task.display_id}, "${task.title}", in the ${task.status} column.` : undefined;
      },
      onDragOver({ active, over }) {
        const task = describe(active.id as string);
        if (!task || !over) return undefined;
        return over.id === task.status
          ? `Task ${task.display_id} is back over its original column, ${task.status}.`
          : `Task ${task.display_id} is over the ${over.id} column.`;
      },
      onDragEnd({ active, over }) {
        const task = describe(active.id as string);
        if (!task) return undefined;
        return over
          ? `Task ${task.display_id} was moved to the ${over.id} column.`
          : `Task ${task.display_id} was dropped outside any column and was not moved.`;
      },
      onDragCancel({ active }) {
        const task = describe(active.id as string);
        return task ? `Moving task ${task.display_id} was cancelled.` : undefined;
      },
    };
  }, [filteredTasks]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    queryClient.cancelQueries({ queryKey: ["tasks", repo] });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const targetStatus = event.over?.id as string | undefined;
    const payload = event.active.data.current as DragPayload | undefined;
    if (!targetStatus || !payload || targetStatus === payload.status) return;
    setStatus.mutate({ id: payload.displayId, status: targetStatus });
  }

  /** Arrow keys move focus between cards — within a column up/down, across
   * columns left/right (landing on the nearest row, since column lengths differ).
   * Pure DOM traversal off `data-board-column`/`data-board-card` markers, no
   * React state — focus order already mirrors the derived column order. */
  function handleBoardKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-board-card]");
    const column = card?.closest<HTMLElement>("[data-board-column]");
    if (!card || !column) return;
    event.preventDefault();

    const allColumns = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-board-column]"));
    const cardsInColumn = Array.from(column.querySelectorAll<HTMLElement>("[data-board-card]"));
    const colIndex = allColumns.indexOf(column);
    const rowIndex = cardsInColumn.indexOf(card);

    if (event.key === "ArrowDown") cardsInColumn[rowIndex + 1]?.focus();
    else if (event.key === "ArrowUp") cardsInColumn[rowIndex - 1]?.focus();
    else {
      const dir = event.key === "ArrowRight" ? 1 : -1;
      for (let i = colIndex + dir; i >= 0 && i < allColumns.length; i += dir) {
        const cards = Array.from(allColumns[i]!.querySelectorAll<HTMLElement>("[data-board-card]"));
        if (cards.length === 0) continue;
        cards[Math.min(rowIndex, cards.length - 1)]?.focus();
        break;
      }
    }
  }

  return (
    <div className="flex h-full flex-col px-8 py-5">
      <div className="shrink-0">
        {data && <WarningStrip warnings={data.warnings} />}

        <FilterBar filters={filters} setFilters={setFilters} statuses={[]} showStatusFilter={false} />

        {isLoading && <p className="text-sm text-ink-4">Loading tasks…</p>}
        {error && <p className="text-sm text-danger-ink">{error.message}</p>}
        {!isLoading && !error && columns.length === 0 && (
          <p className="text-sm text-ink-4">No tasks match the current filters.</p>
        )}
      </div>

      {columns.length > 0 && (
        <DndContext
          sensors={sensors}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto pb-1"
            onKeyDown={handleBoardKeyDown}
          >
            {columns.map((col) => (
              <BoardColumn
                key={col.status}
                repo={repo}
                status={col.status}
                semantic={col.semantic}
                tasks={byStatus.get(col.status) ?? []}
                childCounts={childCounts}
              />
            ))}
          </div>
          <DragOverlay>{activeTask && <TaskCardGhost task={activeTask} />}</DragOverlay>
        </DndContext>
      )}

      <Outlet />
    </div>
  );
}
