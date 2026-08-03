import { useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Modal } from "../ui/Modal";
import { useCreateTask, type NewTaskInput } from "../../lib/mutations";
import { useFields, useRepoTasks } from "../../lib/queries";
import type { Priority, TaskKind } from "../../../shared/contract";

const KINDS: TaskKind[] = ["task", "bug", "story", "epic", "subtask"];
const PRIORITIES: Priority[] = ["low", "medium", "high"];

function currentView(pathname: string): "board" | "table" | "list" {
  if (pathname.includes("/board")) return "board";
  if (pathname.includes("/table")) return "table";
  return "list";
}

export function NewTaskDialog({ repo, onClose }: { repo: string; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: fieldsData } = useFields(repo);
  const { data: epicsData } = useRepoTasks(repo, { kind: "epic" });
  const createTask = useCreateTask(repo);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("task");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [due, setDue] = useState("");
  const [milestone, setMilestone] = useState("");
  const [parent, setParent] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [fixedVersions, setFixedVersions] = useState<string[]>([]);
  const [affectedVersions, setAffectedVersions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const required = fieldsData?.data.fields;
  const epics = epicsData?.data.repos[0]?.tasks ?? [];

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Title is required.";
    if (!description.trim()) next.description = "Description is required.";
    if (required?.priority.required && !priority) next.priority = "Priority is required for this repo.";
    if (required?.assignee.required && !assignee.trim()) next.assignee = "Assignee is required for this repo.";
    if (required?.due.required && !due.trim()) next.due = "Due date is required for this repo.";
    return next;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const input: NewTaskInput = {
      title: title.trim(),
      kind,
      description: description.trim(),
      assignee: assignee.trim() || undefined,
      labels: labels.length > 0 ? labels : undefined,
      fixedVersions: fixedVersions.length > 0 ? fixedVersions : undefined,
      affectedVersions: affectedVersions.length > 0 ? affectedVersions : undefined,
      priority: priority || undefined,
      due: due.trim() || undefined,
      milestone: milestone.trim() || undefined,
      parent: parent || undefined,
    };

    createTask.mutate(input, {
      onSuccess: (result) => {
        if (!result) return;
        onClose();
        navigate(`/r/${encodeURIComponent(repo)}/${currentView(location.pathname)}/t/${encodeURIComponent(result.data.task.display_id)}`);
      },
    });
  }

  return (
    <Modal title="New task" onClose={onClose} maxWidthClassName="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title" error={errors.title}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className={inputClass(!!errors.title)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)} className={inputClass(false)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Priority${required?.priority.required ? " *" : ""}`} error={errors.priority}>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority | "")}
              className={inputClass(!!errors.priority)}
            >
              <option value="">—</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description" error={errors.description}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass(!!errors.description)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Assignee${required?.assignee.required ? " *" : ""}`} error={errors.assignee}>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="email"
              className={inputClass(!!errors.assignee)}
            />
          </Field>
          <Field label={`Due${required?.due.required ? " *" : ""}`} error={errors.due}>
            <input type="text" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass(!!errors.due)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Milestone">
            <input type="text" value={milestone} onChange={(e) => setMilestone(e.target.value)} className={inputClass(false)} />
          </Field>
          <Field label="Parent epic">
            <select value={parent} onChange={(e) => setParent(e.target.value)} className={inputClass(false)}>
              <option value="">—</option>
              {epics.map((epic) => (
                <option key={epic.id} value={epic.display_id}>
                  {epic.display_id} · {epic.title || "(untitled)"}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Labels">
          <TagInput values={labels} onChange={setLabels} placeholder="type, then Enter" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fixed in version(s)">
            <TagInput values={fixedVersions} onChange={setFixedVersions} placeholder="e.g. 1.2.0" />
          </Field>
          <Field label="Affects version(s)">
            <TagInput values={affectedVersions} onChange={setAffectedVersions} placeholder="e.g. 1.0.0" />
          </Field>
        </div>

        {createTask.isError && <p className="text-sm text-danger-ink">{(createTask.error as Error).message}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-control px-4 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-sunk">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createTask.isPending}
            className="rounded-control bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {createTask.isPending ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Chip-list input shared by Labels/Fixed-in/Affects — type a value, Enter or comma
 * commits it as a chip. git-task's `new --fixed-version`/`--affected-version` are
 * repeatable flags just like `--label`, so the interaction matches labels exactly. */
function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function commit() {
    const value = input.trim();
    if (value && !values.includes(value)) onChange([...values, value]);
    setInput("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-line bg-surface px-2 py-1.5 focus-within:border-brand">
      {values.map((value) => (
        <span key={value} className="flex items-center gap-1 rounded-pill bg-neutral-tint px-2 py-0.5 text-micro text-neutral-ink">
          {value}
          <button
            type="button"
            onClick={() => onChange(values.filter((v) => v !== value))}
            className="text-ink-4 hover:text-ink-1"
            aria-label={`Remove ${value}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="min-w-[6rem] flex-1 bg-transparent text-sm text-ink-1 focus:outline-none"
      />
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "w-full rounded-control border bg-surface px-3 py-1.5 text-sm text-ink-1 focus:outline-none",
    hasError ? "border-danger-ink" : "border-line focus:border-brand",
  ].join(" ");
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-micro uppercase tracking-wide text-ink-4">{label}</span>
      {children}
      {error && <span className="mt-1 block text-micro text-danger-ink">{error}</span>}
    </label>
  );
}
