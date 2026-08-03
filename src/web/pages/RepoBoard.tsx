import { useMemo, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { TaskJson } from "../../shared/contract";
import { useRepoTasks } from "../lib/queries";
import { useSetStatus } from "../lib/mutations";
import { useTaskFilters } from "../lib/useTaskFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { filterTasksByQuery } from "../lib/filterTasks";
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
  const byStatus = useMemo(() => groupByStatus(filteredTasks), [filteredTasks]);
  const activeTask = activeId ? filteredTasks.find((t) => t.id === activeId) : undefined;

  // 8px activation distance so a plain click still opens the drawer instead of
  // always starting a drag (§4.4 "onDragStart cancels in-flight refetches").
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

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

  return (
    <div className="px-8 py-5">
      {data && <WarningStrip warnings={data.warnings} />}

      <FilterBar filters={filters} setFilters={setFilters} statuses={[]} showStatusFilter={false} />

      {isLoading && <p className="text-sm text-ink-4">Loading tasks…</p>}
      {error && <p className="text-sm text-danger-ink">{error.message}</p>}
      {!isLoading && !error && columns.length === 0 && (
        <p className="text-sm text-ink-4">No tasks match the current filters.</p>
      )}

      {columns.length > 0 && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex items-start gap-4 overflow-x-auto pb-4">
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
