import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { useTask } from "../lib/queries";
import { TaskDetail } from "../components/task/TaskDetail";

/** GTWEB-8384b5c4: "Task detail is a side drawer apparently but it should have its
 * own dialog." Was a slide-out-from-the-right panel pinned to the viewport edge;
 * now a centered overlay dialog like every other modal in the app (NewTaskDialog,
 * AddRepoDialog, ConfirmDialog) — just wide enough for TaskDetail's two-column
 * layout to have room to breathe. */
export function TaskDialog() {
  const { repo = "", displayId = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useTask(repo, displayId);

  const close = () => navigate(-1);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-1/30 p-4">
      <button type="button" aria-label="Close task detail" className="absolute inset-0" onClick={close} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-card bg-shell shadow-pop">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-3.5">
          <span className="text-sm font-medium text-ink-3">Task detail</span>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-control p-1 text-ink-4 transition-colors hover:bg-surface-sunk hover:text-ink-1"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isLoading && <p className="text-sm text-ink-4">Loading…</p>}
          {error && <p className="text-sm text-danger-ink">{error.message}</p>}
          {data && <TaskDetail repo={repo} task={data.data} />}
        </div>
      </div>
    </div>
  );
}
