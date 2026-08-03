import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import type { TaskJson } from "../../../shared/contract";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useDeleteTask, useDropTask } from "../../lib/mutations";

type Confirming = "delete" | "drop" | null;

/** Delete (soft, synced tombstone) and drop (hard, local-only, no history entry) are
 * different enough in git-task's own model that the confirm text has to spell out
 * the difference, not just "are you sure?" — see drop.rs's own help text. */
export function TaskDangerMenu({ repo, task }: { repo: string; task: TaskJson }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const deleteTask = useDeleteTask(repo, task.display_id);
  const dropTask = useDropTask(repo, task.display_id);

  function afterRemoved() {
    setConfirming(null);
    navigate(`/r/${encodeURIComponent(repo)}/list`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="rounded-control p-1.5 text-ink-4 transition-colors hover:bg-surface-sunk hover:text-ink-1"
        aria-label="Task actions"
      >
        <MoreVertical size={16} />
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-control border border-line bg-shell shadow-lift">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setConfirming("delete");
              }}
              className="block w-full px-3 py-2 text-left text-sm text-ink-2 hover:bg-surface-sunk"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setConfirming("drop");
              }}
              className="block w-full px-3 py-2 text-left text-sm text-danger-ink hover:bg-surface-sunk"
            >
              Drop (local only)
            </button>
          </div>
        </>
      )}

      {confirming === "delete" && (
        <ConfirmDialog
          title={`Delete ${task.display_id}?`}
          body={
            <>
              Records a delete event and syncs to every clone — everyone who pulls sees it gone. This is permanent;
              there is no restore.
            </>
          }
          confirmLabel="Delete"
          onCancel={() => setConfirming(null)}
          busy={deleteTask.isPending}
          onConfirm={() => deleteTask.mutate(undefined, { onSuccess: afterRemoved })}
        />
      )}

      {confirming === "drop" && (
        <ConfirmDialog
          title={`Drop ${task.display_id}?`}
          body={
            <>
              Removes the local ref outright — <strong>no event, no history entry, does not sync</strong>. Any clone
              that already has this task keeps it, and a later pull can bring it right back. Prefer Delete unless you
              specifically want that.
            </>
          }
          confirmLabel="Drop anyway"
          onCancel={() => setConfirming(null)}
          busy={dropTask.isPending}
          onConfirm={() => dropTask.mutate(undefined, { onSuccess: afterRemoved })}
        />
      )}
    </div>
  );
}
