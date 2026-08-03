import { useState, type FormEvent } from "react";
import type { TaskJson, TaskKind, Priority } from "../../../shared/contract";
import { useEditTask, type EditTaskPatch } from "../../lib/mutations";

const KINDS: TaskKind[] = ["task", "bug", "story", "epic", "subtask"];
const PRIORITIES: Priority[] = ["low", "medium", "high"];

/**
 * Always submits every field (empty string -> null = clear) and lets the server's
 * editTask diff against its own fresh `show` decide what's actually changed — see
 * commands.ts's editTask doc comment. Simpler than tracking "touched" state here,
 * and correct by construction: a field the user didn't touch round-trips to the same
 * value it started at, which the server treats as no-op.
 */
export function TaskEditForm({ repo, task, onDone }: { repo: string; task: TaskJson; onDone: () => void }) {
  const editTask = useEditTask(repo, task.display_id);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [kind, setKind] = useState<TaskKind>(task.kind);
  const [priority, setPriority] = useState<Priority | "">(task.priority ?? "");
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [due, setDue] = useState(task.due ?? "");
  const [milestone, setMilestone] = useState(task.milestone ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const patch: EditTaskPatch = {
      title: title.trim(),
      description,
      kind,
      priority: priority || null,
      assignee: assignee.trim() || null,
      due: due.trim() || null,
      milestone: milestone.trim() || null,
    };
    editTask.mutate(patch, { onSuccess: onDone });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-card bg-surface-sunk p-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-control border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-1 focus:border-brand focus:outline-none"
        placeholder="Title"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink-1 focus:border-brand focus:outline-none"
        placeholder="Description"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as TaskKind)}
          className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink-1"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | "")}
          className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink-1"
        >
          <option value="">No priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Assignee email"
          className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink-1"
        />
        <input
          type="text"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          placeholder="Due"
          className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink-1"
        />
        <input
          type="text"
          value={milestone}
          onChange={(e) => setMilestone(e.target.value)}
          placeholder="Milestone"
          className="col-span-2 rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink-1"
        />
      </div>

      {editTask.isError && <p className="text-sm text-danger-ink">{(editTask.error as Error).message}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-control px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={editTask.isPending}
          className="rounded-control bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {editTask.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
