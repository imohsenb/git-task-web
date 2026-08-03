import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { useTask } from "../lib/queries";
import { TaskDetail } from "../components/task/TaskDetail";

export function TaskDrawer() {
  const { repo = "", displayId = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useTask(repo, displayId);

  const close = () => navigate(-1);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close task detail"
        className="absolute inset-0 bg-ink-1/20"
        onClick={close}
      />
      <div className="relative z-10 flex h-full w-[480px] shrink-0 flex-col overflow-y-auto bg-shell shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <span className="text-sm font-medium text-ink-3">Task detail</span>
          <button
            type="button"
            onClick={close}
            className="rounded-control p-1 text-ink-4 transition-colors hover:bg-surface-sunk hover:text-ink-1"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          {isLoading && <p className="text-sm text-ink-4">Loading…</p>}
          {error && <p className="text-sm text-danger-ink">{error.message}</p>}
          {data && <TaskDetail task={data.data} />}
        </div>
      </div>
    </div>
  );
}
