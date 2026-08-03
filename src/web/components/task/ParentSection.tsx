import { useState } from "react";
import type { TaskJson } from "../../../shared/contract";
import { useClearParent, useSetParent } from "../../lib/mutations";
import { useRepoTasks } from "../../lib/queries";

export function ParentSection({ repo, task }: { repo: string; task: TaskJson }) {
  const setParent = useSetParent(repo, task.display_id);
  const clearParent = useClearParent(repo, task.display_id);
  const { data: epicsData } = useRepoTasks(repo, { kind: "epic" });
  const [isPicking, setIsPicking] = useState(false);
  const [epicId, setEpicId] = useState("");

  const epics = (epicsData?.data.repos[0]?.tasks ?? []).filter((e) => e.id !== task.id);

  function submit() {
    if (!epicId) return;
    setParent.mutate(epicId, { onSuccess: () => setIsPicking(false) });
  }

  if (task.parent_display_id) {
    return (
      <div>
        <dt className="text-micro uppercase text-ink-4">Epic</dt>
        <dd className="mt-1 flex items-center gap-2 font-mono text-sm text-ink-2">
          {task.parent_display_id}
          <button
            type="button"
            onClick={() => clearParent.mutate()}
            disabled={clearParent.isPending}
            className="font-sans text-micro text-ink-4 hover:text-danger-ink"
          >
            Remove
          </button>
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt className="text-micro uppercase text-ink-4">Epic</dt>
      <dd className="mt-1 text-sm">
        {isPicking ? (
          <div className="flex items-center gap-2">
            <select
              value={epicId}
              onChange={(e) => setEpicId(e.target.value)}
              className="rounded-control border border-line bg-surface px-2 py-1 text-micro text-ink-1"
            >
              <option value="">Pick an epic…</option>
              {epics.map((epic) => (
                <option key={epic.id} value={epic.display_id}>
                  {epic.display_id} · {epic.title || "(untitled)"}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={submit}
              disabled={!epicId || setParent.isPending}
              className="rounded-control bg-brand px-2.5 py-1 text-micro font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              Set
            </button>
            <button type="button" onClick={() => setIsPicking(false)} className="text-micro text-ink-3 hover:text-ink-1">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setIsPicking(true)} className="text-micro text-ink-4 hover:text-ink-1">
            + Set parent epic
          </button>
        )}
      </dd>
    </div>
  );
}
