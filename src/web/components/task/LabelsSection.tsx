import { useState } from "react";
import { X } from "lucide-react";
import type { TaskJson } from "../../../shared/contract";
import { semanticClasses } from "../../lib/status";
import { useAddLabel, useRemoveLabel } from "../../lib/mutations";

export function LabelsSection({ repo, task }: { repo: string; task: TaskJson }) {
  const addLabel = useAddLabel(repo, task.display_id);
  const removeLabel = useRemoveLabel(repo, task.display_id);
  const [input, setInput] = useState("");
  const { tint, ink } = semanticClasses("neutral");

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
          <span
            key={label}
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-pill py-0.5 pl-2 pr-0.5 text-micro font-medium ${tint} ${ink}`}
          >
            {label}
            <button
              type="button"
              onClick={() => removeLabel.mutate(label)}
              disabled={removeLabel.isPending}
              className="rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100 hover:text-danger-ink"
              aria-label={`Remove label ${label}`}
            >
              <X size={10} />
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
