import { useState } from "react";
import type { TaskJson } from "../../../shared/contract";
import { Pill } from "../ui/Pill";
import { useAddLabel, useRemoveLabel } from "../../lib/mutations";

export function LabelsSection({ repo, task }: { repo: string; task: TaskJson }) {
  const addLabel = useAddLabel(repo, task.display_id);
  const removeLabel = useRemoveLabel(repo, task.display_id);
  const [input, setInput] = useState("");

  function submit() {
    const value = input.trim();
    if (!value) return;
    addLabel.mutate(value, { onSuccess: () => setInput("") });
  }

  return (
    <div>
      <h3 className="mb-2 text-micro uppercase text-ink-4">Labels</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {task.labels.map((label) => (
          <span key={label} className="inline-flex items-center gap-1">
            <Pill sem="neutral">{label}</Pill>
            <button
              type="button"
              onClick={() => removeLabel.mutate(label)}
              disabled={removeLabel.isPending}
              className="text-ink-4 hover:text-danger-ink"
              aria-label={`Remove label ${label}`}
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
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="+ label"
          className="w-24 rounded-control border border-line bg-surface px-2 py-1 text-micro text-ink-1 focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  );
}
